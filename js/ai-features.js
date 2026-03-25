// js/ai-features.js — FinBuddy Advanced AI Support

// 📸 Fast Image Compressor (Standalone)
window.compressImage = function(file, maxWidth, maxHeight, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.filter = 'grayscale(100%) contrast(120%) brightness(105%)';
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality || 0.65);
        resolve(dataUrl.split(',')[1]); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// 🏎️ AI CONFIG (Pointing to our micro-proxy)
const AI_PROXY = 'http://localhost:3002/api/ai';

// ── 🎙️ VOICE TRACKING (Updated for Pro AI) ────────────────────────
window.startVoiceTracking = function() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Speech Recognition not supported in this browser.', 'error'); return; }

  const rec = new SR(); rec.lang = 'en-IN';
  showToast('Listening for expense details...', 'success');

  rec.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    showToast(`Parsing: "${text}"`, '');
    
    try {
      const data = await callAIParse(text);
      if (data && data.amount) {
        fillExpenseForm(data);
        showToast(`Heard ₹${data.amount} for ${data.category}`, 'success');
      }
    } catch (e) {
      console.error('Voice parse error:', e);
      showToast('AI analysis failed. Please enter manually.', 'error');
    }
  };
  rec.start();
};

// ── 📸 RECEIPT SCANNING (FAST AI OCR) ─────────────────────────────
window.processReceiptOCR = async function(file) {
  if (!file) return;
  
  const btn = document.querySelector('.tool-btn:nth-child(2)');
  if (btn) btn.disabled = true;
  showToast('AI Vision analysis in progress...', 'success');

  try {
    // ⚡ Compress first (reduces payload to ~30KB)
    const base64 = await window.compressImage(file, 800, 800, 0.6);
    const result = await callAIParse(null, base64, 'image/jpeg');

    if (result && result.amount) {
      fillExpenseForm(result);
      showToast(`Scan Complete: ₹${result.amount} ✓`, 'success');
    } else {
      showToast('Could not find total amount clearly.', 'error');
    }
  } catch (err) {
    console.error('Scan Error:', err);
    showToast('AI Scanning failed. Is the server running?', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ── 🧠 SMART INSIGHTS ─────────────────────────────────────────────
window.refreshInsights = async function() {
  const body = document.getElementById('insightsBody');
  const catTotals = getCatTotals();
  const total = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const budget = (gData && gData.budget) || 10000;
  
  body.innerHTML = `
    <div class="insight-placeholder"><div class="pulse-line"></div><div class="pulse-line"></div></div>
    <p class="insight-loading-text">Generating strategic analysis...</p>
  `;

  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  const prompt = `Act as a senior financial strategist.
User Profile: Total Spent ₹${total.toLocaleString()}, Budget ₹${budget.toLocaleString()}.
Top Category: ${topCat ? topCat[0] : 'None'} (₹${topCat ? topCat[1].toLocaleString() : 0}).
Generate exactly 3 extremely brief, professional, and actionable financial tips as a bulleted list. 
Rules: 
1. Use real data from the profile. 
2. NO long paragraphs. 
3. One sentence per bullet maximum.`;

  try {
    const reply = await callAIChat([{ role: 'user', content: prompt }]);
    // Basic formatting for bullet points if the AI didn't provide them perfectly
    const formatted = reply
      .replace(/\n- /g, '<br>• ')
      .replace(/\n\* /g, '<br>• ')
      .replace(/\n\d\. /g, '<br>• ')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
    body.innerHTML = `<div class="insight-text">${formatted}</div>`;
  } catch (err) {
    body.innerHTML = `<p class="insight-err">Check server connection.</p>`;
  }
};

// ── 💬 CHATBOT (AI BRAIN) ──────────────────────────────────────────
window.toggleChat = function() {
  document.getElementById('chatbotWrap').classList.toggle('show');
};

let chatHistory = [];

window.sendChat = async function() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  // ── Inject fresh data context ──
  const catTotals = getCatTotals();
  const totalSpent = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const budget = (gData && gData.budget) || 0;
  
  const systemPrompt = {
    role: 'system',
    content: `You are FinBuddy AI. 
Current State: Total Spent ₹${totalSpent.toLocaleString()}, Budget ₹${budget.toLocaleString()}. 
Categories: ${JSON.stringify(catTotals)}.
Rules: 
1. Keep responses CONCISE and highly organized. 
2. Use BULLET POINTS and BOLD terms for readability. 
3. Reference the user's data ONLY if relevant. 
4. Don't be too chatty; focus on value.`
  };

  // Keep history manageable
  if (chatHistory.length === 0) chatHistory.push(systemPrompt);
  else chatHistory[0] = systemPrompt; // Always keep data fresh

  appendMsg(text, 'user');
  input.value = '';

  const typingId = 'typing-' + Date.now();
  appendMsg('<div class="pulse-line" style="width:40px;height:12px;margin:0"></div>', 'bot', typingId);

  try {
    chatHistory.push({ role: 'user', content: text });
    const reply = await callAIChat(chatHistory);
    
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    // Convert markdown specifically for the UI
    const formatted = reply
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n- (.*?)\n/g, '<br>• $1<br>')
      .replace(/\n\n/g, '<br>');

    appendMsg(formatted, 'bot');
    chatHistory.push({ role: 'assistant', content: reply });
    
    if (chatHistory.length > 21) chatHistory = [chatHistory[0], ...chatHistory.slice(-10)];
  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    appendMsg('Oops! Check backend connection.', 'bot');
  }
};

function appendMsg(html, sender, id) {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'msg ' + sender;
  if (id) div.id = id;
  div.innerHTML = html;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

// ── 🛠️ HELPER FUNCTIONS ───────────────────────────────────────────
async function callAIParse(txt, fileBase64, fileType) {
  const res = await fetch(`${AI_PROXY}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txt, fileBase64, fileType })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Parse failed');
  return data.data;
}

async function callAIChat(messages) {
  const res = await fetch(`${AI_PROXY}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Chat failed');
  return data.choices[0].message.content;
}

function fillExpenseForm(data) {
  openModal();
  if (data.title) document.getElementById('expTitle').value = data.title;
  if (data.amount) document.getElementById('expAmount').value = data.amount;
  if (data.category) document.getElementById('expCat').value = data.category;
  if (data.date) document.getElementById('expDate').value = data.date;
  if (data.note) document.getElementById('expNote').value = data.note;
}

function getCatTotals() {
  const totals = {};
  if (typeof gExpenses !== 'undefined') {
    gExpenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount); });
  }
  return totals;
}

function getTopCategory() {
  const sorted = Object.entries(getCatTotals()).sort((a,b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

// ── 📧 EMAIL ALERTS (AI-POWERED) ───────────────────────────────────
let alertSent90 = false; 
let initialCheckDone = false; 

window.checkEmailAlerts = async function() {
  if (!gUser || !gUser.email) return; 
  
  const catTotals = getCatTotals();
  const total = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const budget = (gData && gData.budget) || 0;
  if (!budget) return;

  const pct = (total / budget) * 100;

  // 1. Critical 90% Alert (During active session)
  if (pct >= 90) {
    if (!alertSent90 && initialCheckDone) {
      alertSent90 = true;
      showToast('Budget Critical! AI Alert Sending...', 'error');
      
      const banner = document.getElementById('alertBanner');
      if (banner) {
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 5000);
      }

      const content = await callAIGenEmail('critical', { budget, spent: total, pct: pct.toFixed(1), categories: catTotals });
      await sendEmailJS('Critical Budget Alert', content);
    }
  } else {
    alertSent90 = false; 
  }

  if (!initialCheckDone) initialCheckDone = true;
};

// ── 📊 PERIODIC REPORTS (Weekly) ──
window.checkPeriodicReports = async function() {
  if (!gUser || !gUser.email) return;
  const now = Date.now();
  const lastWeekly = localStorage.getItem('lastWeeklyReport') || 0;
  
  // Only trigger if 7 days passed since last report
  if (now - lastWeekly > 7 * 24 * 60 * 60 * 1000) {
    localStorage.setItem('lastWeeklyReport', now);
    showToast('Sending your Weekly AI Insights...', 'success');
    
    const catTotals = getCatTotals();
    const total = Object.values(catTotals).reduce((a, b) => a + b, 0);
    const content = await callAIGenEmail('Weekly', { 
      budget: (gData && gData.budget) || 0, 
      spent: total, 
      categories: catTotals, 
      expenses: gExpenses.slice(0, 15) 
    });
    await sendEmailJS('Your Weekly FinBuddy Report', content);
  }
};

async function callAIGenEmail(type, data) {
  const res = await fetch(`${AI_PROXY}/generate-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data })
  });
  const resData = await res.json();
  return resData.content;
}

async function sendEmailJS(subject, body) {
  if (!window.emailjs || !gUser || !gUser.email) {
    console.warn('Cannot send email: gUser.email is missing.');
    return;
  }
  
  // Initialize
  emailjs.init('uAvs_vvHsOuxv7jf8'); 

  // Mapping exactly to what the template expected
  const params = {
    to_name: gUser.displayName || gUser.email.split('@')[0],
    to_email: gUser.email.trim(),
    subject: subject,
    message: body
  };

  try {
    const res = await emailjs.send('service_6q1bauo', 'template_uqgsj85', params);
    if (res.status === 200) console.log('✅ AI Email sent successfully!');
  } catch (err) {
    console.error('❌ EmailJS Error:', err);
  }
}

// Init on load
setTimeout(() => {
  if (gUser) {
    refreshInsights();
    checkPeriodicReports(); // Run once per login/session check
  }
}, 4000);
