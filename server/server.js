require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');
const admin = require('firebase-admin');

// 🔐 Firebase Admin Init
const serviceAccount = require('./expense-tracker-c3176-firebase-adminsdk-fbsvc-d1beeb1e6f.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FB_DB_URL
});
const db = admin.firestore();

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

// 🛡️ INDESTRUCTIBLE EXTRACTION ENGINE
app.post('/api/ai/parse', async (req, res) => {
  const { txt, fileBase64, fileType } = req.body;
  const orKey = process.env.OPENROUTER_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const systemPrompt = `You are a professional financial assistant. Extract merchant details, amount, category, date, and a specific note into a JSON object.
  RULES:
  1. MERCHANT: The store, person, or company name.
  2. AMOUNT: Numeric total only (e.g., 500).
  3. CATEGORY: Exactly one of: Food, Travel, Shopping, Bills, Entertainment, Health, Education, Other.
  4. DATE: Format YYYY-MM-DD.
  5. NOTE: Only extract if it contains high-value context (e.g., "Gift for Mom", "Coffee with client"). 
     ⚠️ IMPORTANT: Leave as an empty string "" if the text contains no useful extra context or just repeats information. 
     🚫 DO NOT put generic text like "Bought coffee" or "Spent money" here.
  6. OUTPUT: Return ONLY the raw JSON object. No explanations.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  if (fileBase64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'Parse this financial document.' },
        { type: 'image_url', image_url: { url: `data:${fileType || 'image/jpeg'};base64,${fileBase64}` } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: `Text: "${txt}"` });
  }

  // 🔄 THE INDESTRUCTIBLE ENGINE (Optimized for both Vision and Text)
  const models = [];
  
  if (!fileBase64) {
    // Top-tier Text Reasoners (Priority for Voice)
    models.push({ provider: 'OR', id: 'google/gemini-2.0-flash-exp:free' });
    models.push({ provider: 'OR', id: 'meta-llama/llama-3.3-70b-instruct:free' });
    models.push({ provider: 'OR', id: 'deepseek/deepseek-chat:free' });
  }

  // Vision / Fallback Models
  models.push({ provider: 'OR', id: 'nvidia/nemotron-nano-12b-v2-vl:free' });
  models.push({ provider: 'OR', id: 'google/gemini-flash-1.5:free' });
  models.push({ provider: 'OR', id: 'meta-llama/llama-3.2-11b-vision-instruct:free' });
  models.push({ provider: 'OR', id: 'qwen/qwen-2-vl-7b-instruct:free' });

  // 🚀 PARALLEL RACE ENGINE (Fix for Latency)
  // Hit top models simultaneously and take the first valid response.
  const task = async (m) => {
    try {
      const isOR = m.provider === 'OR';
      const url = isOR ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions';
      const key = isOR ? orKey : groqKey;
      if (!key) throw new Error('No API Key');

      const response = await axios.post(url, {
        model: m.id,
        messages: messages,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${key}`,
          ...(isOR ? { 'HTTP-Referer': 'http://localhost:3002', 'X-Title': 'Walletly' } : {})
        },
        timeout: 12000 // Tight timeout for parallel race
      });

      const raw = response.data?.choices?.[0]?.message?.content;
      if (!raw) throw new Error('Empty response');

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found');

      const cleaned = JSON.parse(match[0]);
      if (!cleaned.amount) throw new Error('Invalid schema');
      
      console.log('⚡ Parallel Winner:', m.id);
      return cleaned;
    } catch (e) {
      throw e;
    }
  };

  // Select 3-4 best candidates to race
  const candidates = models.slice(0, 4); 

  try {
    const winner = await Promise.any(candidates.map(m => task(m)));
    return res.json({ success: true, data: winner });
  } catch (err) {
    console.error('📊 All models failed parallel race:', err.message);
    return res.status(500).json({ success: false, message: 'AI exhausted all options.' });
  }
});

// 💸 EXTERNAL PAYMENT SYNC (For cross-app Razorpay/Webhook sync)
app.post('/api/payments/external-sync', async (req, res) => {
  // Extract values with deeper search for webhooks (handles nested payload)
  const b = req.body;
  const p = (b.payload && b.payload.payment && b.payload.payment.entity) || {};
  const notes = b.notes || p.notes || {};

  const userId = b.userId || notes.userId || b.user_id || '';
  const amount = b.amount || p.amount || b.total || 0;
  const secret = b.secret || notes.secret || req.headers['x-sync-secret'] || '';

  // Multi-source detection for Merchant and Item Name
  const merchant = b.merchant || notes.merchant || p.description || b.source || b.app || 'External App';
  const itemName = b.itemName || notes.itemName || notes.item || b.item || b.description || notes.description || 'External Purchase';

  // 1️⃣ Validate Secret
  const syncSecret = process.env.SYNC_SECRET_KEY || 'wt_secret_123';
  if (!secret || secret !== syncSecret) {
    console.error(`[Sync] Unauthorized sync attempt for user ${userId}.`);
    return res.status(403).json({ success: false, message: 'Invalid or missing sync secret.' });
  }

  // 2️⃣ Basic Validation
  if (!userId || !amount) {
    return res.status(400).json({ success: false, message: 'Missing userId or amount.' });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found in Walletly.' });
    }

    const userData = userDoc.data();
    const payAmount = (amount > 10000 && !amount.toString().includes('.')) ? parseFloat(amount) / 100 : parseFloat(amount);
    const userName = userData.name || 'External User';
    const groupId = userData.groupId || null;
    const groupRef = groupId ? db.collection('groups').doc(groupId) : null;

    // 🏆 Use 100% Atomic Transaction
    await db.runTransaction(async (t) => {
      // 1. ALL READS FIRST
      const uSnap = await t.get(userRef);
      const uData = uSnap.data();
      const syncToGroup = uData.syncToGroup === true; // Check preference

      let gSnap = null;
      if (groupRef && syncToGroup) {
        gSnap = await t.get(groupRef);
      }

      // 2. ALL WRITES SECOND
      // a. Update Personal Budget
      const currentPB = parseFloat(uData.budget || 0);
      t.update(userRef, { budget: currentPB - payAmount });

      // b. Update Group Budget (Conditional)
      if (gSnap && gSnap.exists) {
        const currentGB = parseFloat(gSnap.data().budget || 0);
        t.update(groupRef, { budget: currentGB - payAmount });
      }

      // c. Record Expense
      const expRef = db.collection('expenses').doc();
      t.set(expRef, {
        title: itemName,
        amount: payAmount,
        category: 'Other',
        date: new Date().toISOString().split('T')[0],
        note: `Synced via ${merchant}${syncToGroup ? ' (Group Sync Enabled)' : ''}`,
        createdBy: userId,
        addedByName: userName,
        userEmail: uData.email || '',
        groupId: groupId,
        groupName: userData.groupName || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // d. Notify User
      const notifRef = db.collection('notifications').doc();
      t.set(notifRef, {
        userId: userId,
        title: merchant, // Use merchant as title
        message: `₹${payAmount.toFixed(2)} spent on ${itemName}.${syncToGroup ? ' (Family Budget Deducted)' : ''}`,
        type: 'sync',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`✅ Synced ₹${payAmount} for User ${userId}`);
    res.json({ success: true, message: `Budget deducted ${userData.syncToGroup ? 'across profiles' : 'individually'} for ₹${payAmount.toFixed(2)}` });
  } catch (error) {
    console.error('🔥 Payment Sync Transaction Failed:', error.message);
    res.status(500).json({ success: false, message: 'Internal transaction error.' });
  }
});

app.post('/api/ai/generate-email', async (req, res) => {
  const { type, data } = req.body;
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_KEY;

  let prompt = "";
  if (type === 'critical') {
    prompt = `Act as a senior lead financial strategist.
    URGENT ALERT: Budget at ${data.pct}% capacity.
    Data: Budget ₹${data.budget}, Total Spent ₹${data.spent}.
    Categories: ${JSON.stringify(data.categories)}.
    
    TASK: Generate a critical warning.
    - MANDATORY: Use Indian Rupees (₹) for all amounts.
    - START WITH DIRECT FINDINGS.
    - LIST 3 ACTION ITEMS as bullet points (•).
    - ONE SENTENCE PER BULLET MAX.
    - NO INTRODUCTIONS. NO CHATTY TEXT. EXTREMELY BRIEF.`;
  } else {
    prompt = `Act as a senior high-stakes financial advisor report. 
    Data: ${JSON.stringify(data)}.
    
    STYLE:
    - MANDATORY: Use Indian Rupees (₹) exclusively.
    - HIGHLY ORGANIZED: Bullet points (•) for all findings.
    - NO FLUFF. NO CHATTY TEXT.
    
    STRUCTURE:
    - 📊 CURRENT STATUS: 2 brief points.
    - ⚠️ CATEGORY RISKS: 2 brief points.
    - ✅ ACTION PLAN: 3 brief points.`;
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
