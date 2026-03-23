require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));

// AI Proxy Routes
app.post('/api/ai/chat', async (req, res) => {
  const { messages } = req.body;
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_KEY;
  const url = process.env.GROQ_API_KEY 
    ? 'https://api.groq.com/openai/v1/chat/completions' 
    : 'https://openrouter.ai/api/v1/chat/completions';
  
  const model = process.env.GROQ_API_KEY 
    ? (process.env.GROQ_MODEL_SCAN || 'llama-3.3-70b-versatile')
    : (process.env.OPENROUTER_MODEL || 'arcee-ai/trinity-large-preview:free');

  try {
    const response = await axios.post(url, {
      model: model,
      messages: messages
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 30000
    });
    res.json(response.data);
  } catch (error) {
    console.error('AI Proxy Error:', error.message);
    res.status(500).json({ error: 'AI Proxy Error', message: error.message });
  }
});

const schema = {
  title: "Merchant or item",
  amount: "Number",
  category: "Food, Travel, Shopping, Bills, Entertainment, Health, Education, Other",
  date: "YYYY-MM-DD",
  note: "Brief note"
};

app.post('/api/ai/parse', async (req, res) => {
  const { txt, fileBase64, fileType } = req.body;
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_KEY;
  
  const systemPrompt = `You are a financial parser. Return ONLY JSON matching this schema: ${JSON.stringify(schema)}.
Rules: 
1. Use null if data missing.
2. For missing dates, use: ${new Date().toISOString().slice(0, 10)}.
3. Valid categories: Food, Travel, Shopping, Bills, Entertainment, Health, Education, Other.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  if (fileBase64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Extract from image.' },
        { type: 'image_url', image_url: { url: `data:${fileType || 'image/jpeg'};base64,${fileBase64}` } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: `Extract from text: "${txt}"` });
  }

  try {
    const url = fileBase64 && process.env.GROQ_API_KEY
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
    
    // Use vision model for images
    const model = (fileBase64 && process.env.GROQ_API_KEY)
        ? (process.env.GROQ_MODEL_VISION || 'llama-3.2-11b-vision-preview')
        : (process.env.OPENROUTER_MODEL_PARSE || 'google/gemini-2.0-flash-exp:free');

    const response = await axios.post(url, {
      model: model,
      messages: messages,
      temperature: 0.1
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 25000
    });

    const raw = response.data?.choices?.[0]?.message?.content;
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('AI Parse Error:', error.message);
    res.status(500).json({ error: 'AI Parse Error', message: error.message });
  }
});

app.post('/api/ai/generate-email', async (req, res) => {
  const { type, data } = req.body;
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_KEY;
  
  let prompt = "";
  if (type === 'critical') {
    prompt = `Act as a senior financial advisor.
Data: Budget ₹${data.budget}, Total Spent ₹${data.spent} (${data.pct}%).
Generate a critical, urgent, but professional email body (no subject) warning the user they are almost out of budget. 
Focus on specific categories if provided: ${JSON.stringify(data.categories)}. 
Include 3 immediate action items to prevent overspending. Use a serious but supportive tone.`;
  } else {
    prompt = `Act as a senior financial strategist.
Type: ${type} Report (Weekly/Monthly).
Financial Data: ${JSON.stringify(data)}.
Generate a comprehensive, highly organized financial report email body (no subject).
Include: 
1. Performance summary vs previous period. 
2. Deep dive into spending clusters. 
3. Future projection. 
4. AI-driven strategic capital preservation plan. 
Keep it "Sure Shot" and formatted with professional bullet points.`;
  }

  try {
    const url = process.env.GROQ_API_KEY 
        ? 'https://api.groq.com/openai/v1/chat/completions' 
        : 'https://openrouter.ai/api/v1/chat/completions';
    
    const response = await axios.post(url, {
      model: process.env.GROQ_MODEL_SCAN || 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: 'Generate only the email body text. Use professional formatting.' }, { role: 'user', content: prompt }],
      temperature: 0.7
    }, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 20000
    });

    res.json({ success: true, content: response.data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: 'AI Email Gen Error', message: error.message });
  }
});

// Serve frontend if explicitly requested (optional for Dev)
app.use(express.static(path.join(__dirname, '../')));

app.listen(PORT, () => {
  console.log(`🚀 AI Server running on http://localhost:${PORT}`);
});
