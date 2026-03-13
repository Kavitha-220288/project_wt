// js/dashboard.js — Walletly Smart Dashboard
// ── Constants ──────────────────────────────────────────────
// ── Constants ──────────────────────────────────────────────
// API Configuration is now handled securely on the backend.
// Use FB_CONFIG injected from /api/config.js

var CAT_COLOR = { Food: '#5b7cfa', Travel: '#34d399', Shopping: '#f0b429', Bills: '#f87171', Entertainment: '#a78bfa', Health: '#fb923c', Education: '#22d3ee', Other: '#94a3b8' };
var CAT_ICON = { Food: '🍽️', Travel: '🚗', Shopping: '🛍️', Bills: '💡', Entertainment: '🎬', Health: '⚕️', Education: '📚', Other: '📦' };

var CAT_KEYWORDS = {
  Food: ['food', 'lunch', 'dinner', 'breakfast', 'cafe', 'coffee', 'restaurant', 'swiggy', 'zomato', 'pizza', 'biryani', 'snack', 'meal', 'grocery', 'groceries', 'bread', 'milk'],
  Travel: ['travel', 'cab', 'petrol', 'fuel', 'uber', 'ola', 'bus', 'train', 'flight', 'metro', 'auto', 'rickshaw', 'toll', 'parking'],
  Shopping: ['shop', 'shopping', 'amazon', 'flipkart', 'clothes', 'dress', 'shoes', 'mall', 'purchase', 'buy', 'bought'],
  Bills: ['bill', 'bills', 'electricity', 'water', 'recharge', 'phone', 'mobile', 'internet', 'wifi', 'rent', 'maintenance', 'gas'],
  Entertainment: ['movie', 'cinema', 'netflix', 'spotify', 'game', 'concert', 'entertainment', 'ott', 'show'],
  Health: ['doctor', 'medicine', 'hospital', 'pharmacy', 'health', 'gym', 'fitness', 'checkup', 'medical'],
  Education: ['book', 'course', 'school', 'college', 'fee', 'tuition', 'education', 'class', 'notebook'],
};

var gUser, gData, gExpenses = [], donutChart = null, gNotifs = [];

// ── Init ────────────────────────────────────────────────────
window.initTheme();
document.getElementById('expDate').valueAsDate = new Date();
document.getElementById('expTime').value = now_hhmm();
document.getElementById('dateStr').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// ── Spotlight Effect ──────────────────────────────────────
document.addEventListener('mousemove', function (e) {
  var cards = document.querySelectorAll('.card, .stat-card, .btn-primary, .btn-google');
  cards.forEach(card => {
    var rect = card.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    card.style.setProperty('--x', x + 'px');
    card.style.setProperty('--y', y + 'px');
  });
});

document.getElementById('modalOverlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });

// ── Modal Tab Switching ─────────────────────────────────────
document.querySelectorAll('.modal-tabs .tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var tab = this.dataset.tab;
    document.querySelectorAll('.modal-tabs .tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    this.classList.add('active');
    var el = document.getElementById(tab); if (el) el.classList.add('active');
  });
});

document.getElementById('startVoiceInput').addEventListener('click', startVoice);

var dropArea = document.getElementById('scanDropArea');
var fileInput = document.getElementById('receiptUpload');
var scanBtn = document.getElementById('scanReceipt');
var previewWrap = document.getElementById('scanPreview');
var previewImg = document.getElementById('scanPreviewImg');
var removeBtn = document.getElementById('scanRemove');
var pendingFile = null;

dropArea.addEventListener('click', function () { fileInput.click(); });
dropArea.addEventListener('dragover', function (e) { e.preventDefault(); dropArea.classList.add('drag-over'); });
dropArea.addEventListener('dragleave', function () { dropArea.classList.remove('drag-over'); });
dropArea.addEventListener('drop', function (e) {
  e.preventDefault(); dropArea.classList.remove('drag-over');
  var f = e.dataTransfer.files[0]; if (f) setReceiptFile(f);
});
fileInput.addEventListener('change', function () { if (this.files[0]) setReceiptFile(this.files[0]); });
removeBtn.addEventListener('click', function () {
  pendingFile = null; fileInput.value = ''; previewWrap.style.display = 'none';
  dropArea.style.display = 'flex'; scanBtn.style.display = 'none';
  var res = document.getElementById('receiptScanResult'); res.innerHTML = ''; res.style.display = 'none';
});
scanBtn.addEventListener('click', function () { if (pendingFile) scanReceipt(pendingFile); });

function setReceiptFile(file) {
  pendingFile = file; previewImg.src = URL.createObjectURL(file);
  dropArea.style.display = 'none'; previewWrap.style.display = 'flex';
  scanBtn.style.display = 'block'; document.getElementById('receiptScanResult').style.display = 'none';
}

// ── Auth + Load ─────────────────────────────────────────────
window.requireAuth(function (user, data) {
  gUser = user; gData = data;
  
  // Diagnostic Logging
  const config = window.FB_CONFIG || {};
  console.log('[Walletly Diagnostic] User:', user.email);
  console.log('[Walletly Diagnostic] EmailJS Config Status:', {
    serviceId: !!config.emailJsServiceId,
    templateId: !!config.emailJsTemplateId,
    publicKey: !!config.emailJsPublicKey
  });

  fbDB.ref('users/' + user.uid + '/expenses').on('value', function (snap) {
    gExpenses = [];
    snap.forEach(function (c) { gExpenses.push(Object.assign({ id: c.key }, c.val())); });
    gExpenses.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    render();
  });

  fbDB.ref('users/' + user.uid + '/notifications').on('value', function (snap) {
    gNotifs = [];
    snap.forEach(function (c) { gNotifs.push(Object.assign({ id: c.key }, c.val())); });
    gNotifs.sort(function (a, b) { return b.time - a.time; });
    renderNotifications();
  });
  var s = data.symbol || '₹';
  var pre = document.getElementById('currencyPrefix'); if (pre) pre.textContent = s;
});

// ── Render ──────────────────────────────────────────────────
function render() {
  var s = sym();
  var budget = gData.budget || 0;
  var total = gExpenses.reduce(function (acc, e) { return acc + Number(e.amount); }, 0);
  var pct = budget > 0 ? Math.min(total / budget * 100, 100) : 0;
  var oldTotal = parseFloat(document.getElementById('sSpent').textContent.replace(/[^0-9.-]+/g, "")) || 0;

  document.getElementById('sBudget').textContent = s + budget.toLocaleString('en-IN');
  animateValue('sSpent', oldTotal, total, 1000, s);

  var remain = budget - total;
  var remEl = document.getElementById('sRemaining');
  remEl.textContent = (remain < 0 ? '-' : '') + s + Math.abs(remain).toLocaleString('en-IN');
  remEl.style.color = remain < 0 ? 'var(--danger)' : remain < budget * 0.2 ? 'var(--gold)' : 'var(--success)';
  document.getElementById('sCount').textContent = gExpenses.length;

  var fill = document.getElementById('progressFill'); fill.style.width = pct + '%';
  fill.className = 'progress-bar-fill' + (pct > 90 ? ' danger' : pct > 70 ? ' warn' : '');
  var badge = document.getElementById('pctBadge'); badge.textContent = Math.round(pct) + '%';
  badge.className = 'badge' + (pct > 90 ? ' badge-red' : pct > 70 ? ' badge-yellow' : ' badge-blue');
  document.getElementById('pSpent').textContent = s + total.toLocaleString('en-IN') + ' spent';
  document.getElementById('pLeft').textContent = remain < 0 ? s + Math.abs(remain).toLocaleString('en-IN') + ' over budget' : s + remain.toLocaleString('en-IN') + ' left';

  var catTotals = {};
  gExpenses.forEach(function (e) { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount); });
  var breakEl = document.getElementById('catBreakdown'); breakEl.innerHTML = '';
  Object.entries(catTotals).sort((a, b) => b[1] - a[1]).forEach(en => {
    var c = en[0], a = en[1], p = total > 0 ? (a / total * 100) : 0;
    breakEl.innerHTML += `<div class="cat-bar-item" id="cat-bar-${c}"><div class="cat-bar-label"><span>${CAT_ICON[c] || '📦'} ${c}</span><span class="cat-amt">${s}${a.toLocaleString('en-IN')}</span></div><div class="cat-mini-bg"><div class="cat-mini-fill" style="width:${p}%;background:${CAT_COLOR[c] || '#94a3b8'}"></div></div></div>`;
  });

  checkBudgetAlerts(pct, total, budget, s);
  checkDigestAlerts(pct, total, budget, s);
  renderList();
  renderDonut(catTotals);
  autoRefreshInsights();
}

// ── Notifications ───────────────────────────────────────────
window.addNotification = function (title, desc) {
  if (!gUser) return;
  fbDB.ref('users/' + gUser.uid + '/notifications').push({
    title: title, desc: desc, time: Date.now(), read: false
  });
};

window.toggleNotifications = function () {
  var dd = document.getElementById('notifDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    gNotifs.filter(n => !n.read).forEach(n => {
      fbDB.ref('users/' + gUser.uid + '/notifications/' + n.id).update({ read: true });
    });
  }
};

window.clearNotifications = function () {
  if (!gUser) return;
  fbDB.ref('users/' + gUser.uid + '/notifications').remove();
  document.getElementById('notifDropdown').classList.remove('open');
};

window.renderNotifications = function () {
  var list = document.getElementById('notifList'), badge = document.getElementById('notifBadge');
  if (!list || !badge) return;
  var unread = gNotifs.filter(n => !n.read).length;
  if (unread > 0) {
    badge.style.display = 'flex'; badge.textContent = unread > 9 ? '9+' : unread;
  } else {
    badge.style.display = 'none';
  }
  if (gNotifs.length === 0) {
    list.innerHTML = '<div class="notif-empty">No new notifications</div>'; return;
  }
  list.innerHTML = gNotifs.map(n =>
    `<div class="notif-item">
      <div class="notif-title">${esc(n.title)} <span class="notif-time">${new Date(n.time).toLocaleDateString()}</span></div>
      <div class="notif-desc">${esc(n.desc)}</div>
    </div>`
  ).join('');
};

document.addEventListener('click', function (e) {
  var wrapper = document.querySelector('.notif-wrapper');
  var dd = document.getElementById('notifDropdown');
  if (wrapper && !wrapper.contains(e.target) && dd && dd.classList.contains('open')) dd.classList.remove('open');
});

// ── Alerts ──────────────────────────────────────────────────
var _alertedLevels = {};
function checkBudgetAlerts(pct, total, budget, s) {
  if (!budget || !gUser) return;
  var banner = document.getElementById('alertBanner'), alertMsg = document.getElementById('alertMsg');
  
  if (pct >= 90) {
    alertMsg.textContent = pct >= 100 ? `Budget exceeded! Spent ${s}${total.toLocaleString('en-IN')}` : `${Math.round(pct)}% of budget used!`;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }

  [90, 100].forEach(lvl => {
    // Make key user-specific so switching accounts works for testing
    var key = 'budget_alert_' + gUser.uid + '_' + lvl + '_' + today();
    if (pct >= lvl) {
      if (!_alertedLevels[key] && !localStorage.getItem(key)) {
        console.log(`[Email System] Triggering ${lvl}% alert for user ${gUser.uid}`);
        _alertedLevels[key] = true; 
        localStorage.setItem(key, '1');
        sendBudgetEmail(lvl, pct, total, budget, s);
      }
    } else {
      _alertedLevels[key] = false; 
      localStorage.removeItem(key);
    }
  });
}

function checkDigestAlerts(pct, total, budget, s) {
  if (!gUser) return;
  var now = Date.now();
  var WEEK_MS = 604800000;
  var MONTH_MS = 2592000000;

  // Weekly Logic
  var keyW = 'digest_weekly_' + gUser.uid;
  var lastW = parseInt(localStorage.getItem(keyW) || '0');
  if (!lastW) {
    localStorage.setItem(keyW, String(now));
  } else if (now - lastW > WEEK_MS) {
    localStorage.setItem(keyW, String(now));
    sendDigestEmail('weekly', pct, total, budget, s);
  }

  // Monthly Logic
  var keyM = 'digest_monthly_' + gUser.uid;
  var lastM = parseInt(localStorage.getItem(keyM) || '0');
  if (!lastM) {
    localStorage.setItem(keyM, String(now));
  } else if (now - lastM > MONTH_MS) {
    localStorage.setItem(keyM, String(now));
    sendDigestEmail('monthly', pct, total, budget, s);
  }
}

function renderList() {
  var s = sym(), cat = document.getElementById('filterCat').value;
  var filtered = cat ? gExpenses.filter(e => e.category === cat) : gExpenses;
  var el = document.getElementById('expenseList');
  if (!filtered.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>No expenses yet.</p></div>'; return; }
  el.innerHTML = '';
  filtered.slice(0, 25).forEach((exp, i) => {
    var color = CAT_COLOR[exp.category] || '#94a3b8', icon = CAT_ICON[exp.category] || '📦';
    var date = exp.date ? new Date(exp.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
    el.innerHTML += `<div class="expense-item" style="animation-delay:${i * 0.03}s">
      <div class="exp-icon" style="background:${color}22">${icon}</div>
      <div class="exp-info"><div class="exp-title">${esc(exp.title)}</div><div class="exp-meta">${exp.category} ${date ? '· ' + date : ''}</div></div>
      <div class="exp-amount">−${s}${Number(exp.amount).toLocaleString('en-IN')}</div>
      <div class="exp-actions"><button class="exp-btn" onclick="openEdit('${exp.id}')">✏</button><button class="exp-btn del" onclick="delExpense('${exp.id}')">🗑</button></div>
    </div>`;
  });
}

function renderDonut(catTotals) {
  var ctx = document.getElementById('donutChart'); if (!ctx) return;
  var entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  var labels = entries.map(e => e[0]), data = entries.map(e => e[1]), colors = labels.map(l => CAT_COLOR[l] || '#94a3b8');
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#0f1320' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '65%' }
  });
  var leg = document.getElementById('donutLegend'); leg.innerHTML = '';
  entries.forEach(en => { leg.innerHTML += `<div class="legend-item"><div class="legend-dot" style="background:${CAT_COLOR[en[0]] || '#94a3b8'}"></div><span class="legend-label">${en[0]}</span><span class="legend-val">${sym()}${en[1].toLocaleString('en-IN')}</span></div>`; });
}

// ── Handlers ────────────────────────────────────────────────
window.openModal = function () {
  document.getElementById('editId').value = ''; document.getElementById('expTitle').value = ''; document.getElementById('expAmount').value = '';
  document.getElementById('expCat').value = ''; document.getElementById('expDate').valueAsDate = new Date(); document.getElementById('expTime').value = now_hhmm();
  document.getElementById('expPayment').value = ''; document.getElementById('expNote').value = '';
  clearSmartResults(); switchModalTab('manual'); document.querySelector('.modal-tabs').style.display = 'flex';
  document.getElementById('modalTitle').textContent = 'Add Expense'; document.getElementById('saveExpBtn').textContent = 'Add Expense';
  document.getElementById('modalOverlay').classList.add('open');
};
window.closeModal = function () { document.getElementById('modalOverlay').classList.remove('open'); };
window.openEdit = function (id) {
  var exp = gExpenses.find(e => e.id === id); if (!exp) return;
  document.getElementById('editId').value = id; document.getElementById('expTitle').value = exp.title; document.getElementById('expAmount').value = exp.amount;
  document.getElementById('expCat').value = exp.category; document.getElementById('expDate').value = exp.date || ''; document.getElementById('expTime').value = exp.time || '';
  document.getElementById('expPayment').value = exp.paymentMethod || ''; document.getElementById('expNote').value = exp.note || '';
  document.querySelector('.modal-tabs').style.display = 'none'; switchModalTab('manual');
  document.getElementById('modalTitle').textContent = 'Edit Expense'; document.getElementById('saveExpBtn').textContent = 'Save Changes';
  document.getElementById('modalOverlay').classList.add('open');
};

window.saveExpense = function () {
  var title = document.getElementById('expTitle').value.trim(), amount = Number(document.getElementById('expAmount').value), cat = document.getElementById('expCat').value;
  var date = document.getElementById('expDate').value, time = document.getElementById('expTime').value, editId = document.getElementById('editId').value;
  if (!title || !amount || !cat || !date) { showToast('Fill required fields', 'error'); return; }
  var btn = document.getElementById('saveExpBtn'); btn.disabled = true;
  var payload = { title, amount, category: cat, date, time: time || '' };
  var ref = editId ? fbDB.ref('users/' + gUser.uid + '/expenses/' + editId) : fbDB.ref('users/' + gUser.uid + '/expenses').push();
  (editId ? ref.update(payload) : ref.set(payload)).then(() => {
    if (!editId) triggerCoinAnimation(cat);
    closeModal();
    showToast('Saved ✓', 'success');
  }).finally(() => { btn.disabled = false; });
};

function triggerCoinAnimation(cat) {
  var sRect = document.getElementById('sBudget').getBoundingClientRect();
  var tRect = document.getElementById('sSpent').getBoundingClientRect();

  for (var i = 0; i < 10; i++) {
    setTimeout(() => {
      var coin = document.createElement('div');
      coin.className = 'coin-particle';
      coin.textContent = ['💰', '🪙', '✨', '₹'][Math.floor(Math.random() * 4)];
      coin.style.left = (sRect.left + sRect.width / 2) + 'px';
      coin.style.top = (sRect.top + sRect.height / 2) + 'px';
      var dx = (tRect.left + tRect.width / 2) - (sRect.left + sRect.width / 2);
      var dy = (tRect.top + tRect.height / 2) - (sRect.top + sRect.height / 2);
      var driftX = (Math.random() - 0.5) * 120;
      var driftY = (Math.random() - 0.5) * 60;
      coin.style.setProperty('--tx', (dx + driftX) + 'px');
      coin.style.setProperty('--ty', (dy + driftY) + 'px');
      document.body.appendChild(coin);
      setTimeout(() => coin.remove(), 1000);
    }, i * 80);
  }

  setTimeout(() => {
    var bar = document.getElementById('cat-bar-' + cat);
    if (bar) {
      bar.classList.add('pulse');
      setTimeout(() => bar.classList.remove('pulse'), 850);
    }
  }, 600);
}

var _animReqs = {};
function animateValue(id, start, end, duration, prefix) {
  var obj = document.getElementById(id); if (!obj) return;
  if (_animReqs[id]) { cancelAnimationFrame(_animReqs[id]); }

  if (start === end || isNaN(start) || isNaN(end)) {
    obj.textContent = (prefix || '') + end.toLocaleString('en-IN');
    return;
  }
  var range = end - start;
  var startTime = performance.now();

  function step(currentTime) {
    var progress = Math.min((currentTime - startTime) / duration, 1);
    var value = Math.floor(progress * range + start);
    obj.textContent = (prefix || '') + value.toLocaleString('en-IN');
    if (progress < 1) {
      _animReqs[id] = requestAnimationFrame(step);
    } else {
      obj.textContent = (prefix || '') + end.toLocaleString('en-IN');
      delete _animReqs[id];
    }
  }
  _animReqs[id] = requestAnimationFrame(step);
}

window.delExpense = function (id) { if (confirm('Delete?')) fbDB.ref('users/' + gUser.uid + '/expenses/' + id).remove().then(() => showToast('Deleted', '')); };

// Redundant parseExpenseWithAI and tryParse removed, now using ai_service.js async function

function startVoice() {
  var btn = document.getElementById('startVoiceInput');
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Use Chrome for voice input', 'error'); return; }
  
  var rec = new SR(); rec.lang = 'en-US';
  rec.onstart = () => { btn.textContent = '🔴 Listening…'; };
  rec.onend = () => { btn.textContent = '🎤 Start Voice Input'; };
  
  rec.onresult = async e => {
    var txt = e.results[0][0].transcript;
    document.getElementById('voiceOutput').textContent = `"${txt}" (Parsing with AI...)`;

    try {
      const p = await parseExpenseWithAI(txt);
      if (p && p.amount) {
        fillForm(p);
        switchModalTab('manual');
        document.getElementById('voiceOutput').textContent = '';
        showToast('Voice data captured!', 'success');
      }
    } catch (err) {
      console.error('Voice parse failed:', err);
      // Fallback to basic regex parsing
      var def = parseExpenseText(txt);
      if (def.amount) { fillForm(def); switchModalTab('manual'); }
      document.getElementById('voiceOutput').textContent = 'AI parsing failed. Filled basic details.';
    }
  };
  rec.start();
}

function scanReceipt(file) {
  var btn = document.getElementById('scanReceipt'); btn.disabled = true;
  var resMsg = document.getElementById('receiptScanResult');
  resMsg.style.display = 'block'; resMsg.textContent = 'Scanning with AI...'; resMsg.className = 'scan-result';
  
  var reader = new FileReader();
  reader.onload = async () => {
    var base64 = reader.result.split(',')[1];
    try {
      const p = await parseExpenseWithAI(null, base64, file.type);
      if (p && p.amount) {
        fillForm(p);
        switchModalTab('manual');
        resMsg.style.display = 'none';
        showToast('Receipt scanned successfully!', 'success');
      } else {
        resMsg.textContent = '❌ Could not extract data. Please enter manually.';
      }
    } catch (err) {
      console.error('Scan Error:', err);
      resMsg.textContent = '❌ AI Scan failed. Try manual entry.';
      resMsg.className = 'scan-result parsed-err';
    }
    btn.disabled = false;
  };
  reader.readAsDataURL(file);
}

// Redundant getAIInsight removed, now using ai_service.js function

async function sendBudgetEmail(lvl, pct, total, budget, s) {
  const config = window.FB_CONFIG || {};
  const publicKey = config.emailJsPublicKey || '';
  const serviceId = config.emailJsServiceId || '';
  const templateId = config.emailJsTemplateId || '';

  if (!publicKey || !serviceId || !templateId) {
    console.error('[Email System] Configuration missing (publicKey/serviceId/templateId). check /api/config.js');
    return;
  }
  if (!gUser) {
    console.warn('[Email System] No user logged in. Skipping email.');
    return;
  }

  console.log(`[Email System] Preparing to send ${lvl}% alert for ${gUser.email}...`);
  try {
    console.log('[Email System] Calling AI for professional content...');
    const aiContent = await generateAIEmailContent(`${lvl}% Budget Alert`, { symbol: s, budget, total, pct });
    console.log('[Email System] AI Content generated successfully.');

    const recipientEmail = gUser.email || gData.email || '';
    console.log('[Email System] Recipient:', recipientEmail);

    if (!recipientEmail) {
      throw new Error('Recipient email address is empty. Check user profile.');
    }

    emailjs.init({ publicKey: publicKey });
    var params = {
      user_name: gUser.displayName || gUser.email || 'Value Customer',
      user_email: recipientEmail,
      to_email: recipientEmail, // Added for template compatibility
      admin: 'Walletly Executive System',
      percentage: Math.round(pct),
      spent: total.toLocaleString('en-IN'),
      budget: budget.toLocaleString('en-IN'),
      level: lvl >= 100 ? 'Budget Exceeded' : 'Strategic Warning',
      insight: aiContent,
      date: today()
    };

    console.log('[Email System] Sending with params:', JSON.stringify({ ...params, user_email: '***', to_email: '***' }));
    await emailjs.send(serviceId, templateId, params);
    console.log('Financial Alert Dispatched Successfully.');
  } catch (error) {
    console.error('Dispatch failed:', error);
  }
}

async function sendDigestEmail(type, pct, total, budget, s) {
  const config = window.FB_CONFIG || {};
  const publicKey = config.emailJsPublicKey || '';
  const serviceId = config.emailJsServiceId || '';
  const templateId = config.emailJsTemplateId || '';

  if (!publicKey || !gUser) return;
  
  try {
    const recipientEmail = gUser.email || gData.email || '';
    if (!recipientEmail) throw new Error('No recipient email found.');

    const aiContent = await generateAIEmailContent(`${type.toUpperCase()} Performance Report`, { symbol: s, budget, total, pct });

    emailjs.init({ publicKey: publicKey });
    await emailjs.send(serviceId, templateId, {
      user_name: gUser.displayName || gUser.email || 'Value Customer',
      user_email: recipientEmail,
      to_email: recipientEmail,
      percentage: Math.round(pct),
      insight: aiContent,
      level: `${type} Executive Summary`,
      date: today()
    });
    console.log(`${type} Analyst Report Sent to ${recipientEmail}.`);
  } catch (err) {
    console.error(`${type} Dispatch Error:`, err);
  }
}

function fillForm(p) {
  if (p.amount) document.getElementById('expAmount').value = p.amount;
  if (p.category) document.getElementById('expCat').value = p.category;
  if (p.title || p.merchant) document.getElementById('expTitle').value = p.title || p.merchant;
  if (p.date) document.getElementById('expDate').value = p.date;
  if (p.time) document.getElementById('expTime').value = p.time;
  if (p.payment_method) document.getElementById('expPayment').value = p.payment_method;
  if (p.note) document.getElementById('expNote').value = p.note;
}
function mapCategory(r) {
  var low = r.toLowerCase();
  if (low.includes('food') || low.includes('restaurant') || low.includes('cafe')) return 'Food';
  if (low.includes('travel') || low.includes('transport') || low.includes('cab')) return 'Travel';
  if (low.includes('shop') || low.includes('amazon') || low.includes('flipkart')) return 'Shopping';
  if (low.includes('bill') || low.includes('utility') || low.includes('rent')) return 'Bills';
  if (low.includes('entertainment') || low.includes('movie') || low.includes('netflix')) return 'Entertainment';
  if (low.includes('health') || low.includes('medical') || low.includes('doctor')) return 'Health';
  if (low.includes('education') || low.includes('book') || low.includes('course')) return 'Education';
  return 'Other';
}
function switchModalTab(id) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id)); document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === id)); }
function clearSmartResults() { document.getElementById('receiptUpload').value = ''; document.getElementById('scanPreview').style.display = 'none'; document.getElementById('scanDropArea').style.display = 'flex'; }
function sym() { return (gData && gData.symbol) || '₹'; }
// ── Smart Insights ──────────────────────────────────────────
var _lastInsights = '';
window.refreshInsights = function () {
  var body = document.getElementById('insightsBody'), s = sym();
  var total = gExpenses.reduce((a, e) => a + Number(e.amount), 0);
  var budget = gData.budget || 0;
  var catBreakdown = {};
  gExpenses.slice(0, 15).forEach(e => catBreakdown[e.category] = (catBreakdown[e.category] || 0) + Number(e.amount));

  body.innerHTML = '<div class="insight-placeholder"><div class="pulse-line"></div><div class="pulse-line"></div><div class="pulse-line"></div></div><p class="insight-loading-text">Analyzing your profile...</p>';

  var topCat = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1])[0];
  var pct = budget > 0 ? (total / budget * 100) : 0;

  var status = pct >= 100 ? 'Critical (Over Budget)' : pct >= 90 ? 'Critical (Near Limit)' : pct >= 75 ? 'Warning' : 'Stable';

  var prompt = `Act as a senior financial auditor for Walletly. User capital status: Spent ${s}${total} of ${s}${budget} (${Math.round(pct)}% depletion). Status: ${status}. ` +
    (topCat ? `Primary expenditure category: ${topCat[0]} (${s}${topCat[1]}). ` : '') +
    `Generate two high-impact, professional financial directives in a single paragraph. Focus on asset liquidity and strategic consolidation. ` +
    (status.includes('Critical') ? 'Advice must be urgent, focusing on immediate spending cessation.' : status === 'Warning' ? 'Advice should be preemptive and risk-mitigating.' : 'Advice should focus on investment optimization.');

  getAIInsight(prompt, text => {
    _lastInsights = text;
    body.innerHTML = `<div class="insight-text">${text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
  }, () => {
    // Fallback if AI fails
    var remain = budget - total;
    var fallback = '';
    if (remain < 0) {
      fallback = `⚠️ You have exceeded your budget by <strong>${s}${Math.abs(remain).toLocaleString()}</strong>. Action required: Stop all non-essential spending.`;
    } else if (pct >= 95) {
      fallback = `🚨 Critical: Only <strong>${s}${remain.toLocaleString()}</strong> left (${Math.round(100 - pct)}%). You risk exceeding your limit today.`;
    } else if (pct >= 80) {
      fallback = `⚠️ Budget Warning: <strong>${Math.round(pct)}%</strong> used. Consider postponing upcoming purchases to stay within your <strong>${s}${budget.toLocaleString()}</strong> limit.`;
    } else {
      fallback = `You have <strong>${s}${remain.toLocaleString()}</strong> remaining. You are doing well! Try to save at least 10% of this balance.`;
    }
    body.innerHTML = `<div class="insight-text">${fallback}</div>`;
  });
};

// Auto-refresh insights only when expenses change significantly or once per session
var _insightInit = false;
function autoRefreshInsights() {
  if (!_insightInit && gExpenses.length > 0) {
    _insightInit = true;
    window.refreshInsights();
  }
}
function now_hhmm() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function pad(n) { return n < 10 ? '0' + n : String(n); }
function today() { return new Date().toISOString().slice(0, 10); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function parseExpenseText(txt) {
  var l = txt.toLowerCase(), res = { amount: null, category: 'Other', title: '' };
  var m = txt.match(/(\d+)/); if (m) res.amount = m[1];
  for (var c in CAT_KEYWORDS) { if (CAT_KEYWORDS[c].some(k => l.includes(k))) { res.category = c; break; } }
  res.title = txt.replace(/\d+/, '').trim(); return res;
}

// ── Chatbot UI logic (Calls ai_service.js) ──
var chatHistory = []; 

window.toggleChat = function () {
  document.getElementById('chatWindow').classList.toggle('open');
};

window.handleChatKey = function (e) {
  if (e.key === 'Enter') sendChatMessage();
};

window.sendChatMessage = async function () {
  var inputEl = document.getElementById('chatInput');
  var val = inputEl.value.trim();
  if (!val) return;

  chatAppendMessage('user-msg', esc(val));
  inputEl.value = '';

  // Initialize or update context using the global helper from ai_service.js
  if (chatHistory.length === 0) {
    chatHistory.push({ role: 'system', content: getSystemPrompt(gExpenses, gData, sym()) });
  } else {
    chatHistory[0].content = getSystemPrompt(gExpenses, gData, sym());
  }
  
  chatHistory.push({ role: 'user', content: val });
  var typingId = chatAppendMessage('ai-msg', 'Typing...');

  try {
    const aiReply = await callOpenRouter(chatHistory);
    
    var chatBody = document.getElementById('chatBody');
    var typingEl = document.getElementById(typingId);
    if (typingEl) chatBody.removeChild(typingEl);

    chatAppendMessage('ai-msg', aiReply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'));
    chatHistory.push({ role: 'assistant', content: aiReply });
  } catch (err) {
    console.error('Chatbot error:', err);
    var chatBody = document.getElementById('chatBody');
    var typingEl = document.getElementById(typingId);
    if (typingEl) chatBody.removeChild(typingEl);
    chatAppendMessage('ai-msg', 'Error: ' + esc(err.message || 'Failed to connect.'));
  }
};

function chatAppendMessage(className, html) {
  var chatBody = document.getElementById('chatBody');
  var div = document.createElement('div');
  div.className = 'chat-msg ' + className;
  var id = 'msg-' + Date.now();
  div.id = id;
  div.innerHTML = html;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
  return id;
}
