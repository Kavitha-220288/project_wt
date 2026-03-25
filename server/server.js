require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
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

  const systemPrompt = `You are a professional financial assistant. Extract merchant details, amount, category, date, and a specific note into a JSON object matching this exact schema:
  {
    "title": "Merchant or Store Name",
    "amount": 500.00,
    "category": "Exactly one of: Food, Travel, Shopping, Bills, Entertainment, Health, Education, Other",
    "date": "YYYY-MM-DD",
    "note": "Short descriptive note or empty string"
  }
  RULES:
  1. TITLE: The most accurate merchant, store, or company name found.
  2. AMOUNT: Numeric total only (e.g., 1250.75). No symbols.
  3. CATEGORY: Map the merchant to the best fit among the provided list.
  4. DATE: Format as YYYY-MM-DD. If missing, use today's date.
  5. OUTPUT: Return ONLY the raw JSON object. No explanations or extra characters.`;

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

  // 🚀 MODEL LIST (Nvidia Nemotron is now #1 as requested)
  const models = [
    { provider: 'OR', id: 'nvidia/nemotron-nano-12b-v2-vl:free' },
    { provider: 'OR', id: 'google/gemini-2.0-flash-exp:free' },
  ];
  
  if (!fileBase64) {
    // Text-only Fallbacks (Used if #1 and #2 fail or are busy)
    models.push({ provider: 'OR', id: 'meta-llama/llama-3.3-70b-instruct:free' });
    models.push({ provider: 'OR', id: 'deepseek/deepseek-chat:free' });
  }

  // Vision / Multimodal Fallbacks (If image is present)
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

  // 🚀 SEQUENTIAL ROBUST ENGINE (Fix for Rate Limits)
  // We try models one by one to avoid triggering 429 (Too Many Requests) on free tiers.
  for (const m of models) {
    try {
      const winner = await task(m);
      return res.json({ success: true, data: winner });
    } catch (e) {
      console.warn(`[AI] Model ${m.id} failed:`, e.message);
      // Continue to next model in list
    }
  }

  // If we reach here, all models in the list failed
  console.error('📊 All AI models exhausted or failed.');
  return res.status(500).json({ 
    success: false, 
    message: 'AI exhausted all options. High traffic on free tier — please try again in a moment.' 
  });
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

  // Multi-source detection for Merchant, Item Name and Category
  const merchant = b.merchant || notes.merchant || p.description || b.source || b.app || 'External App';
  const itemName = b.itemName || notes.itemName || notes.item || b.item || b.description || notes.description || 'External Purchase';
  const category = b.category || notes.category || notes.type || b.cat || 'Other';

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
      // a. Record Expense (Budget subtraction is handled dynamically by UI based on expense records)
      const expRef = db.collection('expenses').doc();
      t.set(expRef, {
        title: itemName,
        amount: payAmount,
        category: category,
        date: new Date().toISOString().split('T')[0],
        note: `Synced via ${merchant}${syncToGroup ? ' (Group Sync Enabled)' : ''}`,
        createdBy: userId,
        addedByName: userName,
        userEmail: uData.email || '',
        groupId: groupId,
        groupName: userData.groupName || null,
        isSync: true, // Mark as synced from external source
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // d. Notifications (Notify all group members if sync shared)
      const notifMsg = `₹${payAmount.toFixed(2)} spent on ${itemName}.${syncToGroup ? ' [Family Budget Deducted]' : ''}`;
      
      // Notify the Buyer
      const uNotifRef = db.collection('notifications').doc();
      t.set(uNotifRef, {
        userId: userId,
        title: merchant,
        message: notifMsg,
        type: 'sync',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notify Group Members (Conditional)
      if (syncToGroup && gSnap && gSnap.exists) {
        const members = gSnap.data().members || [];
        members.forEach(member => {
          if (member.userId !== userId) { // Avoid notifying the buyer twice
            const gNotifRef = db.collection('notifications').doc();
            t.set(gNotifRef, {
              userId: member.userId,
              title: `${merchant} (${userName})`,
              message: notifMsg,
              type: 'sync',
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        });
      }
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

// 🚀 WRAP FOR SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- Realtime Group Chat Logic ---
io.on('connection', (socket) => {
  console.log('User connected to Group Chat:', socket.id);

  // 🚪 Join Group Room
  socket.on('join_group', (groupId) => {
    if (!groupId) return;
    socket.join(groupId);
    socket.currentRoom = groupId; // Store for disconnect track
    
    // Broadcast updated member count
    const room = io.sockets.adapter.rooms.get(groupId);
    const count = room ? room.size : 0;
    io.to(groupId).emit('update_member_count', count);
    
    console.log(`Socket ${socket.id} joined group: ${groupId} (Count: ${count})`);
  });

  // 💬 Messaging Engine (Supports Text, Images, and System Messages)
  socket.on('send_message', async (payload) => {
    const { groupId, text, image, type } = payload;
    if (!groupId || (!text && !image)) return;
    
    // Enrich payload for broadcast
    const msg = {
      ...payload,
      id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
      createdAt: payload.createdAt || new Date().toISOString()
    };

    // 1. Instant Real-time Broadcast
    io.to(groupId).emit('receive_message', msg);

    // 2. Persistent Storage & Notifications
    try {
      const gDoc = await db.collection('groups').doc(groupId).get();
      if (gDoc.exists) {
        const data = gDoc.data();
        const members = data.members || [];
        const senderId = payload.senderId;

        // a. Save to history
        await db.collection('groups').doc(groupId).collection('chat').add({
          ...msg,
          serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // b. Create notifications for other members
        const batch = db.batch();
        members.forEach(m => {
          if (m.userId && m.userId !== senderId) {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
              userId: m.userId,
              title: `💬 ${payload.senderName}`,
              message: (type === 'image' ? 'Sent a family photo' : (text.substring(0, 40) + (text.length > 40 ? '...' : ''))),
              type: 'chat',
              read: false,
              groupId: groupId,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Chat notify error:', err.message);
    }
  });

  // ⌨️ Typing Indicators
  socket.on('typing_start', (groupId) => socket.to(groupId).emit('user_typing_start', socket.id));
  socket.on('typing_stop', (groupId) => socket.to(groupId).emit('user_typing_stop', socket.id));

  socket.on('disconnect', () => {
    if (socket.currentRoom) {
      const room = io.sockets.adapter.rooms.get(socket.currentRoom);
      const count = room ? room.size : 0;
      io.to(socket.currentRoom).emit('update_member_count', count);
    }
    console.log('Socket disconnected:', socket.id);
  });
});

// Serve frontend if explicitly requested (optional for Dev)
app.use(express.static(path.join(__dirname, '../')));

server.listen(PORT, () => {
  console.log(`🚀 AI Server & Real-time Chat running on http://localhost:${PORT}`);
});
