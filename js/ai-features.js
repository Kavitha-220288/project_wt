// js/ai-features.js — FinBuddy Advanced AI Support

// 🧪 TEST EMAIL (Call window.testEmail() in console)
window.testEmail = async function() {
  if (typeof showToast !== 'function') { alert('Common JS not loaded'); return; }
  if (typeof gUser === 'undefined' || !gUser) { showToast('Auth not ready. Wait 1 sec.', 'info'); return; }
  
  showToast('Sending test AI report...', 'info');
  
  try {
    const catTotals = typeof getCatTotals === 'function' ? getCatTotals() : {};
    const total = Object.values(catTotals).reduce((a, b) => a + b, 0);
    const budget = (typeof gData !== 'undefined' && gData.budget) || 10000;
    
    const content = await callAIGenEmail('Weekly', { 
      budget: budget, 
      spent: total, 
      categories: catTotals, 
      expenses: (typeof gExpenses !== 'undefined') ? gExpenses.slice(0, 10) : [] 
    });
    
    await sendEmailJS('FinBuddy: Manual Test Report', content);
    showToast('Test email sent! Check inbox.', 'success');
  } catch (e) {
    console.error('Test Email Failed:', e);
    showToast('Email test failed. Check console.', 'error');
  }
};

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
        // REMOVED grayscale/contrast filters to let Gemini see original receipt colors
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality || 0.8);
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

  if (window.gRec) { try { window.gRec.stop(); } catch(e){} }
  window.gRec = new SR(); 
  const rec = window.gRec;
  rec.lang = 'en-IN';
  rec.interimResults = true; // 🎙️ Enable real-time transcription
  
  const statusEl = document.getElementById('voiceStatus');
  const textEl   = document.getElementById('voiceText');
  const magicTools = document.getElementById('modalMagicTools');

  rec.onstart = () => {
    if (statusEl) statusEl.style.display = 'flex';
    if (textEl)   textEl.textContent = 'Speak now...';
    if (magicTools) magicTools.style.display = 'none'; // 🪄 Hide tools for cleaner UI
    
    // Open modal if not open
    if (typeof openModal === 'function' && !document.getElementById('modalOverlay').classList.contains('active')) {
       openModal();
    }
  };

  rec.onresult = async (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');

    if (textEl) textEl.textContent = `"${transcript}"`;

    if (event.results[0].isFinal) {
      const modal = document.querySelector('.modal');
      if (modal) modal.classList.add('scanning');
      
      try {
        const data = await callAIParse(transcript);
        if (data && data.amount) {
          fillExpenseForm(data);
          showToast(`Heard ₹${data.amount}`, 'success');
        }
      } catch (e) {
        console.error('Voice parse error:', e);
        showToast('AI analysis failed.', 'error');
      } finally {
        if (modal) modal.classList.remove('scanning');
        if (statusEl) statusEl.style.display = 'none';
        if (magicTools) magicTools.style.display = 'block'; // 🪄 Restore tools
      }
    }
  };

  rec.onerror = () => {
    if (typeof window.stopAIActions === 'function') window.stopAIActions();
    showToast('Voice error. Try again.', 'error');
  };

  rec.onend = () => {
    // Keep scanning only if AI is still "thinking" (handled in onresult finally)
  };
  
  rec.start();
};

// ── 📸 RECEIPT SCANNING (FAST AI OCR) ─────────────────────────────
window.processReceiptOCR = async function(file) {
  if (!file) return;
  const btn = document.querySelector('.tool-btn:nth-child(2)');
  if (btn) btn.disabled = true;
  const modal = document.querySelector('.modal');
  if (modal) modal.classList.add('scanning');

  try {
    // ⚡ Fast compression for quick uploads
    const base64 = await window.compressImage(file, 800, 800, 0.5);
    const result = await callAIParse(null, base64, 'image/jpeg');

    if (result) {
      fillExpenseForm(result);
      showToast(`Scan Complete: ₹${result.amount || 'Found'} ✓`, 'success');
    } else {
      throw new Error("Could not extract data");
    }
  } catch (err) {
    console.error('Scan Error:', err);
    showToast('AI Scanning failed. Ensure your OpenRouter key is valid.', 'danger');
  } finally {
    if (btn) btn.disabled = false;
    if (modal) modal.classList.remove('scanning');
  }
};

// ── 🛑 SAFETY STOP (Kill all active AI tasks) ──────────────────────
window.stopAIActions = function() {
  console.log('[AI] Stopping all active tasks...');
  if (window.gRec) {
    try { window.gRec.stop(); } catch(e){}
    window.gRec = null;
  }
  
  // Hide scanning UI
  const statusEl = document.getElementById('voiceStatus');
  const magicTools = document.getElementById('modalMagicTools');
  if (statusEl) statusEl.style.display = 'none';
  if (magicTools) magicTools.style.display = 'block';
  
  const modal = document.querySelector('.modal');
  if (modal) modal.classList.remove('scanning');
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
    // Convert specifically for the UI
    const formatted = reply
      .replace(/\n([-*•])\s/g, '<br>• ') // Fix bullet points
      .replace(/\n(\d\.\s)/g, '<br>$1') // Fix numbered lists
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
      
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
1. MANDATORY: Use Indian Rupees (₹) for ALL amounts. No dollars ($).
2. HIGHLY ORGANIZED: Return items line by line using bullet points (•). 
3. BE CONCISE: Use bold terms for key values. 
4. Don't be too chatty; focus on precision.`
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
      .replace(/\n([-*•])\s/g, '<br>• ') // Multi-style bullet catching
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

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
window.checkEmailAlerts = async function() {
  if (!gUser || !gUser.email) return; 
  
  const catTotals = getCatTotals();
  const total = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const budget = (gData && gData.budget) || 0;
  if (!budget || budget <= 0) return;

  const pct = (total / budget) * 100;
  const lastSentAmount = parseFloat(localStorage.getItem('last90AlertAmount_' + gUser.uid) || '0');

  // 🚨 90% Threshold Alert
  if (pct >= 90) {
    // Only send if we haven't sent for THIS exact total (prevents spam on refresh)
    // AND only if it's been a meaningful change or first time hitting 90%
    if (total > lastSentAmount) {
      localStorage.setItem('last90AlertAmount_' + gUser.uid, total);
      
      // a. Show Visual Banner
      const banner = document.getElementById('alertBanner');
      if (banner) {
        banner.classList.add('show');
        if (window.alertTimer) clearTimeout(window.alertTimer);
        window.alertTimer = setTimeout(() => banner.classList.remove('show'), 3000);
      }

      // b. Send Email Alert (Silent failure to not disturb user flow)
      try {
        const content = await callAIGenEmail('critical', { 
          budget: budget, 
          spent: total, 
          pct: Math.round(pct),
          categories: catTotals 
        });
        await sendEmailJS('FinBuddy: 🚨 CRITICAL BUDGET ALERT (90%)', content);
        console.log('[checkEmailAlerts] Critical email sent.');
      } catch (e) {
        console.error('Critical Email Failed:', e);
      }
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

  // Mapping exactly to what the template might expect (standard and common alternates)
  const params = {
    to_name: gUser.displayName || gUser.email.split('@')[0],
    to_email: gUser.email.trim(),
    to: gUser.email.trim(), // Some templates use 'to'
    user_email: gUser.email.trim(), // Others use 'user_email'
    subject: subject,
    message: body
  };

  console.log('[sendEmailJS] Attempting send with:', params);

  try {
    const res = await emailjs.send('service_6q1bauo', 'template_uqgsj85', params, 'uAvs_vvHsOuxv7jf8');
    if (res.status === 200) console.log('✅ AI Email sent successfully!');
  } catch (err) {
    console.error('❌ EmailJS Error:', err);
  }
}

// Init on load
setTimeout(() => {
  if (typeof gUser !== 'undefined' && gUser) {
    refreshInsights();
    if (typeof checkPeriodicReports === 'function') checkPeriodicReports(); 
  }
}, 4000);
