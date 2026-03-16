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

// ── Security Headers for Auth ──────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// ── Auth Guard for Protected Pages ─────────────────────────
const protectedPages = ['/dashboard.html', '/analytics.html', '/reports.html', '/settings.html', '/setup.html'];
app.use((req, res, next) => {
  // Check if requesting a protected HTML page
  if (protectedPages.includes(req.path)) {
    const cookies = req.headers.cookie || '';
    if (!cookies.includes('wt_logged_in=true')) {
      console.log(`[auth] Unauthorized access to ${req.path}, redirecting to signin.`);
      return res.redirect('/signin.html');
    }
  }
  next();
});

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
const REQUIRED_ENV = ['FB_API_KEY', 'OPENROUTER_KEY']; 
const OPTIONAL_ENV = ['GROQ_API_KEY', 'GROQ_MODEL_SCAN', 'GROQ_MODEL_VISION'];

const missingRequired = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingRequired.length > 0) {
  console.warn(`⚠️ Warning: Missing REQUIRED environment variables: ${missingRequired.join(', ')}`);
}

if (!process.env.GROQ_API_KEY) {
  console.info('ℹ️  Tip: Add GROQ_API_KEY to .env for 10x faster AI response times.');
}

// AI Proxy Routes
app.use('/api/ai', (req, res, next) => {
  const cookies = req.headers.cookie || '';
  if (!cookies.includes('wt_logged_in=true')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Auth session required' });
  }
  next();
});

app.post('/api/ai/chat', async (req, res, next) => {
  const { messages, model } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'Invalid Request',
      message: 'The "messages" field must be a non-empty array.'
    });
  }

  const useGroq = !!process.env.GROQ_API_KEY && (!model || model.includes('groq') || model.includes('llama-3.3'));
  const apiKey = useGroq ? process.env.GROQ_API_KEY : process.env.OPENROUTER_KEY;
  const url = useGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
  const defaultModel = useGroq ? (process.env.GROQ_MODEL_SCAN || 'llama-3.3-70b-versatile') : (process.env.OPENROUTER_MODEL || 'arcee-ai/trinity-large-preview:free');

  try {
    const response = await axios.post(url, {
      model: model || defaultModel,
      messages: messages
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': `http://localhost:${PORT}`,
        'X-Title': 'Walletly'
      },
      timeout: useGroq ? 20000 : 30000 
    });

    if (!response.data?.choices?.[0]) {
      throw new Error('AI provider returned an empty or malformed choice list');
    }

    res.json(response.data);
  } catch (error) {
    // If Groq fails, try to fallback to OpenRouter if we haven't already
    if (useGroq && process.env.OPENROUTER_KEY) {
      console.warn('[chat] Groq failed, falling back to OpenRouter...');
      try {
        const fallbackRes = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: process.env.OPENROUTER_MODEL || 'arcee-ai/trinity-large-preview:free',
          messages: messages
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
            'HTTP-Referer': `http://localhost:${PORT}`,
            'X-Title': 'Walletly'
          },
          timeout: 30000
        });
        return res.json(fallbackRes.data);
      } catch (fbError) {
        return next(fbError);
      }
    }
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

  async parse(txt, fileBase64, fileType) {
    if (!this.apiKey && !process.env.GROQ_API_KEY) {
      throw new Error('No AI API keys (OpenRouter or Groq) configured on the server.');
    }

    const messages = [{ role: 'system', content: this.getSystemPrompt() }];
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

    // 🏎️ THE PARALLEL RACE - Groq vs OpenRouter
    const racers = [];

    // 1. Groq Racer (Primary - Extremely Fast)
    if (process.env.GROQ_API_KEY) {
      const groqModel = fileBase64 ? (process.env.GROQ_MODEL_VISION || 'llama-3.2-11b-vision-preview') : (process.env.GROQ_MODEL_SCAN || 'llama-3.3-70b-versatile');
      racers.push(this.performAIRequest('groq', groqModel, process.env.GROQ_API_KEY, messages, 0));
    }

    // 2. OpenRouter Racers (Fallback - Free tier)
    const orModels = [
      'google/gemma-3-27b-it:free',
      'meta-llama/llama-4-scout:free',
      'nvidia/nemotron-nano-12b-v2-vl:free'
    ];
    orModels.forEach((m, i) => {
      racers.push(this.performAIRequest('openrouter', m, this.apiKey, messages, i + 1));
    });

    console.log(`[ai-race] Starting race with ${racers.length} racers...`);

    try {
      return await Promise.any(racers);
    } catch (aggregateError) {
      console.error('[ai-race] FATAL: All racers failed.');
      throw new Error('All AI engines are currently congested or rate-limited. Please try again in 10 seconds.');
    }
  }

  async performAIRequest(provider, model, key, messages, index) {
    if (!key) throw new Error(`Missing key for ${provider}`);
    
    // Stagger OpenRouter by 200ms increments, Groq starts immediately (index 0)
    if (index > 0) await new Promise(r => setTimeout(r, index * 200));

    const startTime = Date.now();
    const url = provider === 'groq' 
      ? 'https://api.groq.com/openai/v1/chat/completions' 
      : 'https://openrouter.ai/api/v1/chat/completions';

    try {
      const res = await axios.post(url, {
        model: model,
        messages: messages,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': `http://localhost:${PORT}`,
          'X-Title': 'Walletly'
        },
        timeout: provider === 'groq' ? 15000 : 40000 // Groq is fast, OpenRouter gets more time
      });

      const raw = res.data?.choices?.[0]?.message?.content;
      if (!raw) throw new Error(`Empty response from ${provider}/${model}`);

      // Robust JSON extraction
      const match = raw.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : raw;
      const parsed = JSON.parse(jsonStr);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[ai-race] 🏆 Winner: ${provider}/${model} in ${duration}s`);
      return parsed;
    } catch (e) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const errMsg = e.response?.data?.error?.message || e.message;
      console.warn(`[ai-race] ❌ ${provider}/${model} failed after ${duration}s: ${errMsg}`);
      throw e;
    }
  }
}

const expenseParser = new ExpenseParser(process.env.OPENROUTER_KEY, process.env.OPENROUTER_MODEL);

app.post('/api/ai/parse', async (req, res, next) => {
  const { txt, fileBase64, fileType } = req.body;

  if (!txt && !fileBase64) {
    return res.status(400).json({ error: 'Missing Input', message: 'Text or File required for parsing' });
  }

  try {
    const parsedData = await expenseParser.parse(txt, fileBase64, fileType);
    res.json({
      success: true,
      data: parsedData
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
