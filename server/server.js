require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));

// Serve static files from 'client' directory
app.use(express.static(path.join(__dirname, '../client')));

// Firebase Config Endpoint (Injects variables from .env)
app.get('/api/config.js', (req, res) => {
  const config = {
    apiKey: process.env.FB_API_KEY,
    authDomain: process.env.FB_AUTH_DOMAIN,
    databaseURL: process.env.FB_DB_URL,
    projectId: process.env.FB_PROJECT_ID,
    storageBucket: process.env.FB_STORAGE_BUCKET,
    messagingSenderId: process.env.FB_MSG_SENDER_ID,
    appId: process.env.FB_APP_ID,
    emailJsServiceId: process.env.emailjs_serviceid,
    emailJsTemplateId: process.env.template_id,
    emailJsPublicKey: process.env.public_key
  };
  res.type('application/javascript');
  res.send(`window.FB_CONFIG = ${JSON.stringify(config)};`);
});

// Environment Variable Validation
const REQUIRED_ENV = ['OPENROUTER_KEY', 'OPENROUTER_MODEL', 'FB_API_KEY', 'OPENROUTER_MODEL_PARSE'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(`⚠️ Warning: Missing environment variables: ${missingEnv.join(', ')}`);
  console.warn('AI and Firebase features may not function correctly.');
}

// AI Proxy Routes
app.post('/api/ai/chat', async (req, res, next) => {
  const { messages, model } = req.body;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ 
      error: 'Invalid Request', 
      message: 'The "messages" field must be a non-empty array.' 
    });
  }

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: model || process.env.OPENROUTER_MODEL,
      messages: messages
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'HTTP-Referer': `http://localhost:${PORT}`,
        'X-Title': 'Walletly'
      },
      timeout: 30000 // 30s timeout
    });
    
    if (!response.data?.choices?.[0]) {
      throw new Error('AI provider returned an empty or malformed choice list');
    }

    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// Expense Parser Model
class ExpenseParser {
  constructor(apiKey, defaultModel) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.schema = {
      title: "Clean descripton of the merchant or item",
      amount: "Numeric value (no currency symbols)",
      category: "One of: Food, Travel, Shopping, Bills, Entertainment, Health, Education, Other",
      date: "YYYY-MM-DD",
      time: "HH:mm",
      payment_method: "e.g., Cash, Card, UPI",
      note: "Brief description of the item"
    };
  }

  getSystemPrompt() {
    return `You are the Walletly AI Expense Parser. 
Extract expense details from the user's input (voice text or receipt image) into the following JSON format:
${JSON.stringify(this.schema)}

Rules:
1. Return ONLY valid JSON. No markdown blocks, no extra text.
2. If data is missing, use null.
3. For missing dates, use today: ${new Date().toISOString().slice(0, 10)}.
4. Clean titles (e.g., "SWIGGY*RESTAURANT" -> "Restaurant").`;
  }

  async parse(txt, fileBase64, fileType, modelOverride) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_KEY is not configured on the server.');
    }

    let model = modelOverride;
    if (!model) {
      // Use specialized parse model for images, otherwise fallback to default
      model = fileBase64 ? (process.env.OPENROUTER_MODEL_PARSE || this.defaultModel) : this.defaultModel;
    }

    let messages = [{ role: 'system', content: this.getSystemPrompt() }];

    if (fileBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Extract from this receipt image.' },
          { type: 'image_url', image_url: { url: `data:${fileType || 'image/jpeg'};base64,${fileBase64}` } }
        ]
      });
    } else {
      messages.push({ role: 'user', content: `Extract from this text: "${txt}"` });
    }

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: model,
      messages: messages
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': `http://localhost:${PORT}`,
        'X-Title': 'Walletly'
      },
      timeout: 45000 // Parsing images/voice might take longer
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI provider failed to return message content.');
    }

    try {
      // Find JSON block if AI adds extra text (robust to markdown fences)
      const match = content.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : content;
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON Parse Error from AI response:', content);
      throw new Error('AI returned an invalid data format. Please try manual entry.');
    }
  }
}

const expenseParser = new ExpenseParser(process.env.OPENROUTER_KEY, process.env.OPENROUTER_MODEL);

app.post('/api/ai/parse', async (req, res, next) => {
  const { txt, fileBase64, fileType, model } = req.body;
  
  if (!txt && !fileBase64) {
    return res.status(400).json({ error: 'Missing Input', message: 'Text or File required for parsing' });
  }

  try {
    const parsedData = await expenseParser.parse(txt, fileBase64, fileType, model);
    // Standardizing response format for frontend
    res.json({ 
      success: true,
      data: parsedData,
      choices: [{ message: { content: JSON.stringify(parsedData) } }] 
    });
  } catch (error) {
    next(error);
  }
});

// Fallback for SPA (Exclude API routes)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not Found', message: `API route ${req.method} ${req.path} not found.` });
  }
  res.sendFile(path.join(__dirname, '../client/landing.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  const status = err.response?.status || 500;
  let message = 'Internal Server Error';
  
  // Extract clean message from OpenRouter error or Axios error
  if (err.response?.data?.error?.message) {
    message = err.response.data.error.message;
  } else if (err.message) {
    message = err.message;
  }
  
  console.error(`[backend error] ${req.method} ${req.url} (${status}):`, message);
  
  res.status(status).json({
    error: 'Backend Service Error',
    message: message,
    code: err.code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Walletly Server running at http://localhost:${PORT}`);
});
