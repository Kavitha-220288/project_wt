// js/dashboard.js — Bulletproof Edition
// Watches the entire 'expenses' collection and renders what belongs to this user.

var gUser = null;
var gData = {};
var gExpenses   = [];   // expenses visible to current user
var gMyExpenses = [];   // only added by current user
var gChart = null;
var gEditId = null;

// ─── Tab System ──────────────────────────────────────────────────────────────
window.switchTab = function (tabId) {
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(function (p) {
    p.classList.remove('active');
  });
  var pane = document.getElementById('tab-' + tabId);
  if (pane) pane.classList.add('active');

  if (tabId === 'overview')     renderOverview();
  if (tabId === 'all-expenses') renderAllExpenses();
  if (tabId === 'my-expenses')  renderMyExpenses();
};

// ─── Delete ──────────────────────────────────────────────────────────────────
window.deleteExpense = function (id) {
  if (!confirm('Delete this expense?')) return;
  window.fbFS.collection('expenses').doc(id).delete()
    .then(function () { showToast('Deleted ✓', ''); })
    .catch(function (e) { showToast(e.message, 'error'); });
};

// ─── Toggle chat ─────────────────────────────────────────────────────────────
window.toggleChat = function () {
  var el = document.getElementById('chatbotWrap');
  if (el) el.classList.toggle('open');
};

// ─── Modal: open / close ─────────────────────────────────────────────────────
window.openModal = function (editId) {
  gEditId = editId || null;
  var overlay = document.getElementById('modalOverlay');
  if (!overlay) return;

  // Reset form fields
  ['expTitle', 'expAmount', 'expCat', 'expNote'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var df = document.getElementById('expDate');
  if (df) df.valueAsDate = new Date();

  if (gEditId) {
    var exp = gExpenses.find(function (e) { return e.id === gEditId; });
    if (exp) {
      document.getElementById('expTitle').value  = exp.title    || '';
      document.getElementById('expAmount').value = exp.amount   || '';
      document.getElementById('expCat').value    = exp.category || '';
      document.getElementById('expNote').value   = exp.note     || '';
      if (df) df.value = exp.date || '';
    }
    setTxt('modalTitle', 'Edit Expense');
    setTxt('saveExpBtn', 'Update Expense');
  } else {
    setTxt('modalTitle', 'Add Expense');
    setTxt('saveExpBtn', 'Save Expense');
  }
  overlay.classList.add('open');
};

window.closeModal = function () {
  var overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
  gEditId = null;
};

// ─── Save Expense ─────────────────────────────────────────────────────────────
window.saveExpense = function () {
  if (!gUser) { showToast('Not signed in', 'error'); return; }

  var title  = (document.getElementById('expTitle').value  || '').trim();
  var amount = parseFloat(document.getElementById('expAmount').value);
  var cat    = document.getElementById('expCat').value;
  var date   = document.getElementById('expDate').value;
  var note   = (document.getElementById('expNote').value   || '').trim();

  if (!title || isNaN(amount) || amount <= 0 || !cat || !date) {
    showToast('Fill in all required fields', 'error');
    return;
  }

  var btn = document.getElementById('saveExpBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  var payload = {
    title:       title,
    amount:      amount,
    category:    cat,
    date:        date,
    note:        note,
    createdBy:   gUser.uid,
    userEmail:   gUser.email || '',
    addedByName: (gData.name) ? gData.name : (gUser.email || '').split('@')[0],
    groupId:     gData.groupId || null,
    groupName:   gData.groupName || null,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp()
  };

  var col = window.fbFS.collection('expenses');

  if (gEditId) {
    delete payload.createdAt;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    col.doc(gEditId).update(payload)
      .then(function () { showToast('Updated ✓', 'success'); window.closeModal(); })
      .catch(function (e) {
        showToast(e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Update Expense'; }
      });
  } else {
    col.add(payload)
      .then(function (ref) {
        console.log('Expense saved. ID:', ref.id, ' UID:', gUser.uid);
        showToast('Expense added ✓', 'success');
        window.closeModal();
      })
      .catch(function (e) {
        console.error('Save error:', e);
        showToast(e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Save Expense'; }
      });
  }
};

// ─── Auth Entry Point ─────────────────────────────────────────────────────────
window.requireAuth(async function (user, data) {
  gUser = user;
  gData = data || {};

  console.log('[Dashboard] Auth OK. UID:', gUser.uid, 'gData:', JSON.stringify(gData));

  // Pull fresh user doc so we have latest budget / groupId
  try {
    var uSnap = await window.fbFS.collection('users').doc(gUser.uid).get();
    if (uSnap.exists) {
      gData = Object.assign({}, gData, uSnap.data());
    }
    // If user is in a group, pull group budget
    if (gData.groupId) {
      var gSnap = await window.fbFS.collection('groups').doc(gData.groupId).get();
      if (gSnap.exists) {
        var gd = gSnap.data();
        if (gd.budget)    gData.budget    = Number(gd.budget);
        if (gd.symbol)    gData.symbol    = gd.symbol;
        if (gd.name)      gData.groupName = gd.name;
        var gl = document.getElementById('groupNameLabel');
        if (gl) { gl.textContent = '👨‍👩‍👧‍👦 ' + (gd.name || 'Group'); gl.style.display = 'inline-flex'; }
      }
    } else {
      gData.budget = Number(gData.budget) || 0;
    }
  } catch (err) {
    console.error('[Dashboard] Profile load error:', err);
  }

  console.log('[Dashboard] Final gData:', JSON.stringify(gData));

  // Set date string
  var ds = document.getElementById('dateStr');
  if (ds) ds.textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Tab visibility (watermark styling for non-grouped)
  var tabNav = document.getElementById('mainTabNav');
  if (tabNav) {
    var myExpBtn = document.querySelector('button[data-tab="my-expenses"]');
    var allExpBtn = document.querySelector('button[data-tab="all-expenses"]');
    
    if (gData.groupId) {
      if (myExpBtn) { myExpBtn.style.opacity = '1'; myExpBtn.style.pointerEvents = 'auto'; myExpBtn.title = ''; }
      if (allExpBtn) { allExpBtn.style.opacity = '1'; allExpBtn.style.pointerEvents = 'auto'; allExpBtn.title = ''; }
    } else {
      if (myExpBtn) { myExpBtn.style.opacity = '0.4'; myExpBtn.style.pointerEvents = 'none'; myExpBtn.title = 'Requires Family Group'; }
      if (allExpBtn) { allExpBtn.style.opacity = '0.4'; allExpBtn.style.pointerEvents = 'none'; allExpBtn.title = 'Requires Family Group'; }
      switchTab('overview');
    }
  }

  // Update sidebar user display
  setTxt('userName', gData.name || gUser.email);
  var av = document.getElementById('userAvatar');
  if (av) av.textContent = (gData.name || gUser.email || 'U').charAt(0).toUpperCase();

  // Logout button
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && !logoutBtn._ls) {
    logoutBtn._ls = true;
    logoutBtn.addEventListener('click', function () {
      window.fbAuth.signOut().then(function () { window.location.href = 'index.html'; });
    });
  }

  // Start listening for expenses and notifications
  renderStats();  // show budget immediately (expenses = 0 until snapshot fires)
  listenForInvitations();
  loadExpenses();
});

// ─── Load Expenses (real-time listener) ─────────────────────────────────────
function loadExpenses() {
  if (!gUser) return;
  console.log('[loadExpenses] Attaching listener. UID =', gUser.uid, ' groupId =', gData.groupId);

  window.fbFS.collection('expenses').onSnapshot(
    function (snap) {
      console.log('[loadExpenses] Snapshot fired. Total docs in collection:', snap.size);

      gExpenses   = [];
      gMyExpenses = [];

      snap.forEach(function (doc) {
        var exp = Object.assign({ id: doc.id }, doc.data());

        var isMine   = exp.createdBy === gUser.uid;
        var inGroup  = !!(gData.groupId && exp.groupId && exp.groupId === gData.groupId);

        if (isMine || inGroup) {
          gExpenses.push(exp);
        }
        if (isMine) {
          gMyExpenses.push(exp);
        }
      });

      console.log('[loadExpenses] After filter → gExpenses:', gExpenses.length, ' gMyExpenses:', gMyExpenses.length);

      // Sort newest date first
      var byDate = function (a, b) { return (b.date || '').localeCompare(a.date || ''); };
      gExpenses.sort(byDate);
      gMyExpenses.sort(byDate);

      // Always re-render stats and overview
      renderStats();
      renderOverview();

      // Re-render whichever tab is active
      var activeBtn = document.querySelector('.tab-btn.active');
      if (activeBtn) {
        var tid = activeBtn.getAttribute('data-tab');
        if (tid === 'all-expenses') renderAllExpenses();
        if (tid === 'my-expenses')  renderMyExpenses();
      }
    },
    function (err) {
      console.error('[loadExpenses] Snapshot ERROR:', err.code, err.message);
      showToast('Could not load expenses: ' + err.message, 'error');
    }
  );
}

// ─── Render Stats ─────────────────────────────────────────────────────────────
function renderStats() {
  var sym    = gData.symbol || '₹';
  var budget = Number(gData.budget) || 0;
  var total  = gExpenses.reduce(function (s, e) { return s + Number(e.amount || 0); }, 0);
  var left   = budget - total;

  setTxt('sBudget',    sym + fmt(budget));
  setTxt('sSpent',     sym + fmt(total));
  setTxt('sRemaining', sym + fmt(left));
  setTxt('sCount',     gExpenses.length);

  var pct = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;
  var pf  = document.getElementById('progressFill');
  var pb  = document.getElementById('pctBadge');
  if (pf) {
    pf.style.width = pct.toFixed(1) + '%';
    pf.classList.remove('warn', 'danger');
    if (pct >= 90) pf.classList.add('danger');
    else if (pct >= 75) pf.classList.add('warn');
  }
  if (pb) pb.textContent = Math.round(pct) + '%';

  setTxt('pSpent', sym + fmt(total) + ' spent');
  setTxt('pLeft',  sym + fmt(Math.max(0, left)) + ' left');
}

// ─── Render Overview Tab ──────────────────────────────────────────────────────
function renderOverview() {
  var catTotals = {};
  gExpenses.forEach(function (e) {
    var c = e.category || 'Other';
    catTotals[c] = (catTotals[c] || 0) + Number(e.amount || 0);
  });

  renderCatBreakdown(catTotals);
  updateDonutChart(catTotals);
  renderList('overviewExpenseList', gExpenses.slice(0, 10));

  var rc = document.getElementById('recentCount');
  if (rc) rc.textContent = gExpenses.length + ' total';
}

// ─── Render All Expenses Tab ──────────────────────────────────────────────────
function renderAllExpenses() {
  if (window.filterList) window.filterList('all');
  else renderList('allExpenseList', gExpenses);
  
  var el = document.getElementById('allExpTotal');
  if (el) el.textContent = (gData.symbol || '₹') + fmt(gExpenses.reduce(function (s, e) { return s + Number(e.amount || 0); }, 0));
}

// ─── Render My Expenses Tab ──────────────────────────────────────────────────
function renderMyExpenses() {
  if (window.filterList) window.filterList('my');
  else renderList('myExpenseList', gMyExpenses);

  var el = document.getElementById('myExpTotal');
  if (el) el.textContent = (gData.symbol || '₹') + fmt(gMyExpenses.reduce(function (s, e) { return s + Number(e.amount || 0); }, 0));
}

// ─── Filter Lists ─────────────────────────────────────────────────────────────
window.filterList = function(type) {
  var searchText = '';
  var catValue = '';
  var listToFilter = [];
  var listContainerId = '';
  
  if (type === 'all') {
    searchText = (document.getElementById('searchAll').value || '').toLowerCase().trim();
    catValue = document.getElementById('catFilterAll').value || '';
    listToFilter = gExpenses;
    listContainerId = 'allExpenseList';
  } else if (type === 'my') {
    searchText = (document.getElementById('searchMy').value || '').toLowerCase().trim();
    catValue = document.getElementById('catFilterMy').value || '';
    listToFilter = gMyExpenses;
    listContainerId = 'myExpenseList';
  } else {
    return;
  }

  var filtered = listToFilter.filter(function(e) {
    if (catValue && e.category !== catValue) return false;
    if (searchText && !(e.title || '').toLowerCase().includes(searchText)) return false;
    return true;
  });

  renderList(listContainerId, filtered);
};

// ─── Core List Renderer ───────────────────────────────────────────────────────
function renderList(containerId, items) {
  var box = document.getElementById(containerId);
  if (!box) { console.warn('[renderList] container not found:', containerId); return; }

  box.innerHTML = '';

  if (!items || items.length === 0) {
    box.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">🧾</div>' +
        '<p>No expenses yet.<br>Tap <strong>+ Add Expense</strong> to get started.</p>' +
      '</div>';
    return;
  }

  var sym = gData.symbol || '₹';

  items.forEach(function (e) {
    var row = document.createElement('div');
    row.className = 'expense-item';
    row.innerHTML =
      '<div class="exp-icon">' + catIcon(e.category) + '</div>' +
      '<div class="exp-info">' +
        '<div class="exp-title">' + esc(e.title) + '</div>' +
        '<div class="exp-meta">' +
          esc(e.category || 'Other') + ' &bull; ' + (e.date || '—') +
          (e.addedByName ? ' &bull; ' + esc(e.addedByName) : '') +
        '</div>' +
      '</div>' +
      '<div class="exp-amount">' + sym + fmt(e.amount) + '</div>' +
      '<div class="exp-actions">' +
        '<button class="exp-btn"     onclick="openModal(\'' + e.id + '\')" title="Edit">✏️</button>' +
        '<button class="exp-btn del" onclick="deleteExpense(\'' + e.id + '\')" title="Delete">🗑️</button>' +
      '</div>';
    box.appendChild(row);
  });
}

// ─── Category Breakdown Bars ──────────────────────────────────────────────────
function renderCatBreakdown(totals) {
  var container = document.getElementById('catBreakdown');
  if (!container) return;
  container.innerHTML = '';

  var cats = Object.keys(totals);
  if (!cats.length) return;

  var grandTotal = cats.reduce(function (s, c) { return s + totals[c]; }, 0);
  var palette    = ['#6366f1', '#f87171', '#34d399', '#f0b429', '#a78bfa', '#fb923c'];

  cats.forEach(function (cat, i) {
    var pct   = grandTotal > 0 ? Math.round(totals[cat] / grandTotal * 100) : 0;
    var color = palette[i % palette.length];
    var row   = document.createElement('div');
    row.className = 'cat-bar-item';
    row.innerHTML =
      '<div class="cat-bar-label">' +
        '<span>' + catIcon(cat) + ' ' + cat + '</span>' +
        '<span class="cat-amt">₹' + fmt(totals[cat]) + '</span>' +
      '</div>' +
      '<div class="cat-mini-bg">' +
        '<div class="cat-mini-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
      '</div>';
    container.appendChild(row);
  });
}

// ─── Doughnut Chart ───────────────────────────────────────────────────────────
function updateDonutChart(totals) {
  var ctx = document.getElementById('donutChart');
  if (!ctx || !window.Chart) return;
  if (gChart) { gChart.destroy(); gChart = null; }

  var labels = Object.keys(totals);
  if (!labels.length) return;

  gChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: Object.values(totals),
        backgroundColor: ['#6366f1','#f87171','#34d399','#f0b429','#a78bfa','#fb923c'],
        borderWidth: 0
      }]
    },
    options: { cutout: '70%', plugins: { legend: { display: false } } }
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────
function listenForInvitations() {
  if (typeof window.listenForNotifications === 'function') {
    window.listenForNotifications(gUser.uid);
  }
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function setTxt(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function catIcon(cat) {
  var m = { Food:'🍔', Travel:'🚗', Shopping:'🛍', Bills:'💡', Entertainment:'🎬', Health:'❤️', Education:'📚', Other:'📦' };
  return m[cat] || '📦';
}