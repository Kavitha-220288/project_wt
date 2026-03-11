// js/dashboard.js
var CAT_COLOR = { Food:'#5b7cfa',Travel:'#34d399',Shopping:'#f0b429',Bills:'#f87171',Entertainment:'#a78bfa',Health:'#fb923c',Education:'#22d3ee',Other:'#94a3b8' };
var CAT_ICON  = { Food:'🍔',Travel:'🚗',Shopping:'🛍',Bills:'💡',Entertainment:'🎬',Health:'❤️',Education:'📚',Other:'📦' };

var gUser, gData, gExpenses = [], donutChart = null;

window.initTheme();

// Set today's date in modal
document.getElementById('expDate').valueAsDate = new Date();

// Date display
document.getElementById('dateStr').textContent = new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

// Modal overlay click-outside
document.getElementById('modalOverlay').addEventListener('click', function(e){
  if (e.target === this) closeModal();
});

window.requireAuth(function(user, data) {
  gUser = user; gData = data;
  // Real-time listener
  fbDB.ref('users/'+user.uid+'/expenses').on('value', function(snap) {
    gExpenses = [];
    snap.forEach(function(c){ gExpenses.push(Object.assign({id:c.key}, c.val())); });
    gExpenses.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    render();
  });
});

function render() {
  var sym    = gData.symbol || '₹';
  var budget = gData.budget || 0;
  var total  = gExpenses.reduce(function(s,e){ return s+Number(e.amount); }, 0);
  var remain = budget - total;
  var pct    = budget > 0 ? Math.min(total/budget*100, 100) : 0;

  // Stat cards
  document.getElementById('sBudget').textContent    = sym + budget.toLocaleString('en-IN');
  document.getElementById('sSpent').textContent     = sym + total.toLocaleString('en-IN');
  var remEl = document.getElementById('sRemaining');
  remEl.textContent = (remain < 0 ? '-' : '') + sym + Math.abs(remain).toLocaleString('en-IN');
  remEl.style.color = remain < 0 ? 'var(--danger)' : remain < budget*0.2 ? 'var(--gold)' : 'var(--success)';
  document.getElementById('sCount').textContent = gExpenses.length;

  // Progress
  var fill = document.getElementById('progressFill');
  fill.style.width = pct+'%';
  fill.className = 'progress-bar-fill'+(pct>90?' danger':pct>70?' warn':'');
  var badge = document.getElementById('pctBadge');
  badge.textContent = Math.round(pct)+'%';
  badge.className = 'badge'+(pct>90?' badge-red':pct>70?' badge-yellow':' badge-blue');
  document.getElementById('pSpent').textContent = sym+total.toLocaleString('en-IN')+' spent';
  document.getElementById('pLeft').textContent  = remain < 0
    ? sym+Math.abs(remain).toLocaleString('en-IN')+' over budget'
    : sym+remain.toLocaleString('en-IN')+' left';

  // Category breakdown
  var catTotals = {};
  gExpenses.forEach(function(e){ catTotals[e.category]=(catTotals[e.category]||0)+Number(e.amount); });
  var breakEl = document.getElementById('catBreakdown');
  breakEl.innerHTML = '';
  Object.entries(catTotals).sort(function(a,b){return b[1]-a[1];}).forEach(function(en) {
    var c = en[0], a = en[1], p = total>0?(a/total*100):0;
    breakEl.innerHTML += '<div class="cat-bar-item"><div class="cat-bar-label"><span>'+(CAT_ICON[c]||'📦')+' '+c+'</span><span class="cat-amt">'+sym+a.toLocaleString('en-IN')+'</span></div><div class="cat-mini-bg"><div class="cat-mini-fill" style="width:'+p+'%;background:'+(CAT_COLOR[c]||'#94a3b8')+'"></div></div></div>';
  });

  // Budget alert
  if (pct >= 90) {
    var msg = pct >= 100
      ? '⚠️ Budget exceeded! Spent '+sym+total.toLocaleString('en-IN')+' of '+sym+budget.toLocaleString('en-IN')
      : '⚠️ '+Math.round(pct)+'% of budget used!';
    document.getElementById('alertMsg').textContent = msg;
    document.getElementById('alertBanner').classList.add('show');
  }

  renderList();
  renderDonut(catTotals);
}

function renderList() {
  var sym = gData.symbol || '₹';
  var cat = document.getElementById('filterCat').value;
  var filtered = cat ? gExpenses.filter(function(e){ return e.category===cat; }) : gExpenses;
  var el = document.getElementById('expenseList');

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🧾</div><p>No expenses yet.<br>Add your first one!</p></div>';
    return;
  }

  el.innerHTML = '';
  filtered.slice(0,25).forEach(function(exp, i) {
    var color = CAT_COLOR[exp.category]||'#94a3b8';
    var icon  = CAT_ICON[exp.category]||'📦';
    var date  = exp.date ? new Date(exp.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '';
    var div = document.createElement('div');
    div.className = 'expense-item';
    div.style.animationDelay = (i*0.03)+'s';
    div.innerHTML =
      '<div class="exp-icon" style="background:'+color+'22">'+icon+'</div>'+
      '<div class="exp-info"><div class="exp-title">'+esc(exp.title)+'</div><div class="exp-meta">'+exp.category+(exp.note?' · '+esc(exp.note):'')+(date?' · '+date:'')+'</div></div>'+
      '<div class="exp-amount">−'+sym+Number(exp.amount).toLocaleString('en-IN')+'</div>'+
      '<div class="exp-actions">'+
        '<button class="exp-btn" onclick="openEdit(\''+exp.id+'\')">✏</button>'+
        '<button class="exp-btn del" onclick="delExpense(\''+exp.id+'\')">🗑</button>'+
      '</div>';
    el.appendChild(div);
  });
}

function renderDonut(catTotals) {
  var ctx = document.getElementById('donutChart');
  if (!ctx) return;
  var entries = Object.entries(catTotals).sort(function(a,b){return b[1]-a[1];});
  var labels  = entries.map(function(e){return e[0];});
  var data    = entries.map(function(e){return e[1];});
  var colors  = labels.map(function(l){return CAT_COLOR[l]||'#94a3b8';});
  var cardColor = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#0f1320';

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels:labels, datasets:[{ data:data, backgroundColor:colors, borderWidth:2, borderColor:cardColor }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return ' '+c.label+': '+(gData.symbol||'₹')+Number(c.raw).toLocaleString('en-IN'); } } } }, cutout:'65%' }
  });

  var sym = gData.symbol||'₹';
  var leg = document.getElementById('donutLegend');
  leg.innerHTML = '';
  entries.forEach(function(en) {
    leg.innerHTML += '<div class="legend-item"><div class="legend-dot" style="background:'+(CAT_COLOR[en[0]]||'#94a3b8')+'"></div><span class="legend-label">'+en[0]+'</span><span class="legend-val">'+sym+en[1].toLocaleString('en-IN')+'</span></div>';
  });
}

// ── Modal ──
window.openModal = function() {
  document.getElementById('editId').value = '';
  document.getElementById('expTitle').value = '';
  document.getElementById('expAmount').value = '';
  document.getElementById('expCat').value = '';
  document.getElementById('expDate').valueAsDate = new Date();
  document.getElementById('expNote').value = '';
  document.getElementById('modalTitle').textContent = 'Add Expense';
  document.getElementById('saveExpBtn').textContent = 'Add Expense';
  document.getElementById('modalOverlay').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('open');
};

window.openEdit = function(id) {
  var exp = gExpenses.find(function(e){return e.id===id;});
  if (!exp) return;
  document.getElementById('editId').value     = id;
  document.getElementById('expTitle').value   = exp.title;
  document.getElementById('expAmount').value  = exp.amount;
  document.getElementById('expCat').value     = exp.category;
  document.getElementById('expDate').value    = exp.date||'';
  document.getElementById('expNote').value    = exp.note||'';
  document.getElementById('modalTitle').textContent  = 'Edit Expense';
  document.getElementById('saveExpBtn').textContent  = 'Save Changes';
  document.getElementById('modalOverlay').classList.add('open');
};

window.saveExpense = function() {
  var title  = document.getElementById('expTitle').value.trim();
  var amount = Number(document.getElementById('expAmount').value);
  var cat    = document.getElementById('expCat').value;
  var date   = document.getElementById('expDate').value;
  var note   = document.getElementById('expNote').value.trim();
  var editId = document.getElementById('editId').value;

  if (!title||!amount||!cat||!date) { showToast('Please fill all required fields','error'); return; }

  var btn = document.getElementById('saveExpBtn');
  btn.disabled = true; btn.textContent = '…';

  var payload = { title:title, amount:amount, category:cat, date:date, note:note };
  var ref = editId
    ? fbDB.ref('users/'+gUser.uid+'/expenses/'+editId)
    : fbDB.ref('users/'+gUser.uid+'/expenses').push();

  (editId ? ref.update(payload) : ref.set(payload)).then(function() {
    closeModal();
    showToast(editId ? 'Expense updated ✓' : 'Expense added ✓', 'success');
  }).catch(function(e) {
    showToast('Error: '+e.message, 'error');
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = editId ? 'Save Changes' : 'Add Expense';
  });
};

window.delExpense = function(id) {
  if (!confirm('Delete this expense?')) return;
  fbDB.ref('users/'+gUser.uid+'/expenses/'+id).remove()
    .then(function(){ showToast('Expense deleted',''); })
    .catch(function(e){ showToast('Error: '+e.message,'error'); });
};

function esc(s) {
  return String(s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});
}