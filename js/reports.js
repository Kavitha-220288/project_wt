// js/reports.js
var CAT_ICON = { Food:'🍔',Travel:'🚗',Shopping:'🛍',Bills:'💡',Entertainment:'🎬',Health:'❤️',Education:'📚',Other:'📦' };

var gUser, gData, gExpenses = [];

window.initTheme();

// Set default pickers
var now = new Date();
var yr  = now.getFullYear();
var mo  = String(now.getMonth()+1).padStart(2,'0');
document.getElementById('monthPicker').value = yr+'-'+mo;
document.getElementById('fromDate').value = yr+'-'+mo+'-01';
document.getElementById('toDate').value   = now.toISOString().slice(0,10);

// Week picker default = current ISO week
var startOfWeek = new Date(now);
startOfWeek.setDate(now.getDate() - now.getDay() + 1);
var wkYr = startOfWeek.getFullYear();
var wkN  = Math.ceil(((startOfWeek - new Date(wkYr,0,1))/86400000 + 1)/7);
document.getElementById('weekPicker').value = wkYr+'-W'+String(wkN).padStart(2,'0');

// Handle report type dropdown
document.getElementById('reportTypeSelect').addEventListener('change', function(e) {
  var type = e.target.value;
  document.getElementById('card-weekly').style.display = type === 'weekly' ? 'block' : 'none';
  document.getElementById('card-monthly').style.display = type === 'monthly' ? 'block' : 'none';
  document.getElementById('card-custom').style.display = type === 'custom' ? 'block' : 'none';
  renderPreview();
});

// Update preview when inputs change
document.getElementById('weekPicker').addEventListener('change', renderPreview);
document.getElementById('monthPicker').addEventListener('change', renderPreview);
document.getElementById('fromDate').addEventListener('change', renderPreview);
document.getElementById('toDate').addEventListener('change', renderPreview);

window.requireAuth(function(user, data) {
  gUser = user; gData = data;
  var topUserNameEl = document.getElementById('topUserName');
  if (topUserNameEl) {
    topUserNameEl.textContent = data.name || user.email.split('@')[0];
  }

  fbFS.collection('expenses').onSnapshot(function(snap) {
    gExpenses = [];
    snap.forEach(function(doc) {
      var exp = Object.assign({id:doc.id}, doc.data());
      var isMine = exp.createdBy === user.uid;
      var inGroup = !!(data.groupId && exp.groupId && exp.groupId === data.groupId);
      if (isMine || inGroup) {
        gExpenses.push(exp);
      }
    });
    gExpenses.sort(function(a, b) {
      return (a.date || '').localeCompare(b.date || '');
    });
    renderPreview();
  });
});

function renderPreview() {
  var sym      = gData.symbol || '₹';
  var type     = document.getElementById('reportTypeSelect').value;
  var from, to, label;

  if (type === 'weekly') {
    var wv = document.getElementById('weekPicker').value;
    if (!wv) return;
    var parts = wv.split('-W');
    var d = new Date(Number(parts[0]),0,1+(Number(parts[1])-1)*7);
    d.setDate(d.getDate() - d.getDay() + 1);
    from  = d.toISOString().slice(0,10);
    var de = new Date(d); de.setDate(d.getDate()+6);
    to    = de.toISOString().slice(0,10);
    label = 'Week '+parts[1]+' '+parts[0];
  } else if (type === 'monthly') {
    var mv = document.getElementById('monthPicker').value;
    if (!mv) return;
    var mp = mv.split('-');
    from  = mv+'-01';
    var lastDay = new Date(Number(mp[0]), Number(mp[1]), 0).getDate();
    to    = mv+'-'+lastDay;
    label = new Date(from+'T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  } else {
    from  = document.getElementById('fromDate').value;
    to    = document.getElementById('toDate').value;
    if (!from || !to) { label = 'Select a date range'; }
    else if (from > to) { label = 'Invalid Range'; }
    else { label = new Date(from).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) + ' — ' + new Date(to).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
  }

  var exp = (from && to && from <= to) ? gExpenses.filter(function(e){ return e.date>=from && e.date<=to; }) : [];

  document.getElementById('insightsBadge').textContent = label;

  var total  = exp.reduce(function(s,e){return s+Number(e.amount);},0);
  var cats   = {};
  exp.forEach(function(e){ cats[e.category]=(cats[e.category]||0)+Number(e.amount); });
  var topCat = Object.entries(cats).sort(function(a,b){return b[1]-a[1];})[0];
  var daysCount = (from && to) ? Math.max(1, Math.round((new Date(to)-new Date(from))/86400000)+1) : 1;

  document.getElementById('insightsTotals').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:0.7rem;border-bottom:1px solid var(--border)">'+
      '<div class="rt-label" style="font-weight:600">Total Spent</div><div class="rt-val" style="margin-top:0;font-size:1.2rem;color:var(--danger)">'+sym+total.toLocaleString('en-IN')+'</div>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:0.7rem;border-bottom:1px solid var(--border)">'+
      '<div class="rt-label" style="font-weight:600">Transactions</div><div class="rt-val" style="margin-top:0;font-size:1rem">'+exp.length+'</div>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:0.7rem;border-bottom:1px solid var(--border)">'+
      '<div class="rt-label" style="font-weight:600">Top Category</div><div class="rt-val" style="margin-top:0;font-size:.95rem">'+(topCat ? (CAT_ICON[topCat[0]]||'')+' '+topCat[0] : '—')+'</div>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:center">'+
      '<div class="rt-label" style="font-weight:600">Daily Average</div><div class="rt-val" style="margin-top:0;font-size:.95rem">'+sym+Math.round(total/daysCount).toLocaleString('en-IN')+'</div>'+
    '</div>';

  var tbody = document.getElementById('previewBody');
  document.getElementById('previewCount').textContent = exp.length + ' items';

  if (!exp.length) {
    if (!from || !to) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">Please select a valid report period.</td></tr>';
    else tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No expenses in this period.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  exp.forEach(function(e) {
    var date = e.date ? new Date(e.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '';
    tbody.innerHTML += '<tr><td>'+date+'</td><td style="font-weight:500">'+esc(e.title)+'</td><td class="td-cat">'+(CAT_ICON[e.category]||'')+' '+e.category+'</td><td style="color:var(--muted)">'+esc(e.note||'—')+'</td><td class="td-amount">'+sym+Number(e.amount).toLocaleString('en-IN')+'</td></tr>';
  });
  tbody.innerHTML += '<tr class="total-row"><td colspan="4" style="text-align:right;padding-right:1rem;border-top:2px solid var(--border);color:var(--muted);font-weight:600;text-transform:uppercase;font-size:.7rem;letter-spacing:.05em">Total</td><td class="td-amount" style="border-top:2px solid var(--border);font-size:1.1rem;color:var(--text)">'+sym+total.toLocaleString('en-IN')+'</td></tr>';
}

window.downloadReport = function(type, format) {
  var sym  = gData.symbol || '₹';
  var from, to, label;

  if (type === 'weekly') {
    var wv = document.getElementById('weekPicker').value;
    if (!wv) { showToast('Please select a week','error'); return; }
    var parts = wv.split('-W');
    var d = new Date(Number(parts[0]),0,1+(Number(parts[1])-1)*7);
    d.setDate(d.getDate() - d.getDay() + 1);
    from  = d.toISOString().slice(0,10);
    var de = new Date(d); de.setDate(d.getDate()+6);
    to    = de.toISOString().slice(0,10);
    label = 'Week '+parts[1]+'-'+parts[0];
  } else if (type === 'monthly') {
    var mv = document.getElementById('monthPicker').value;
    if (!mv) { showToast('Please select a month','error'); return; }
    var mp = mv.split('-');
    from  = mv+'-01';
    var lastDay = new Date(Number(mp[0]), Number(mp[1]), 0).getDate();
    to    = mv+'-'+lastDay;
    label = new Date(from+'T00:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  } else {
    from  = document.getElementById('fromDate').value;
    to    = document.getElementById('toDate').value;
    if (!from||!to) { showToast('Please select date range','error'); return; }
    if (from > to)  { showToast('Start date must be before end date','error'); return; }
    label = from + ' to ' + to;
  }

  var exp = gExpenses.filter(function(e){ return e.date>=from && e.date<=to; });
  if (!exp.length) { showToast('No expenses found for this period','error'); return; }

  if (format === 'csv') downloadCSV(exp, label, sym);
  else                   downloadPDF(exp, label, sym, from, to);
};

function downloadCSV(exp, label, sym) {
  var rows = [['Date','Title','Category','Amount ('+sym+')','Note']];
  exp.forEach(function(e){
    rows.push([e.date||'', '"'+(e.title||'').replace(/"/g,'""')+'"', e.category||'', Number(e.amount).toFixed(2), '"'+(e.note||'').replace(/"/g,'""')+'"']);
  });
  var total = exp.reduce(function(s,e){return s+Number(e.amount);},0);
  rows.push(['','','Total',total.toFixed(2),'']);

  var csv = rows.map(function(r){return r.join(',');}).join('\n');
  var blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'FinBuddy-'+label.replace(/[^a-z0-9]/gi,'-')+'.csv';
  a.click();
  showToast('CSV downloaded ✓','success');
}

function downloadPDF(exp, label, sym, from, to) {
  var total = exp.reduce(function(s,e){return s+Number(e.amount);},0);
  var cats  = {};
  exp.forEach(function(e){ cats[e.category]=(cats[e.category]||0)+Number(e.amount); });

  var rows = exp.map(function(e) {
    var date = e.date ? new Date(e.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '';
    return '<tr><td>'+date+'</td><td>'+esc(e.title)+'</td><td>'+e.category+'</td><td>'+esc(e.note||'—')+'</td><td style="text-align:right;font-weight:600">'+sym+Number(e.amount).toLocaleString('en-IN')+'</td></tr>';
  }).join('');

  var catRows = Object.entries(cats).sort(function(a,b){return b[1]-a[1];}).map(function(en) {
    var pct = total>0?(en[1]/total*100).toFixed(1):0;
    return '<tr><td>'+(CAT_ICON[en[0]]||'')+' '+en[0]+'</td><td style="text-align:right">'+sym+en[1].toLocaleString('en-IN')+'</td><td style="text-align:right">'+pct+'%</td></tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>FinBuddy Reports</title><style>'+
    'body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#1a1f35;background:#fff}'+
    'h1{font-size:22px;margin-bottom:4px;color:#4060f0} .sub{color:#666;font-size:13px;margin-bottom:24px}'+
    '.summary{display:flex;gap:24px;margin-bottom:28px;flex-wrap:wrap}'+
    '.sum-box{background:#f4f5fc;border-radius:10px;padding:14px 20px;min-width:130px}'+
    '.sum-label{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.05em}'+
    '.sum-val{font-size:18px;font-weight:700;margin-top:4px;color:#4060f0}'+
    'h2{font-size:14px;margin:20px 0 8px;color:#18203a}'+
    'table{width:100%;border-collapse:collapse;font-size:12px}'+
    'th{text-align:left;padding:8px 10px;background:#f4f5fc;color:#556080;font-size:11px;letter-spacing:.04em}'+
    'td{padding:8px 10px;border-bottom:1px solid #eee}'+
    'tr:last-child td{border-bottom:none}'+
    '.total-row{font-weight:700;background:#f4f5fc}'+
    '.footer{margin-top:32px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px;display:flex;justify-content:space-between}'+
    '@media print{body{padding:16px}}</style></head><body>'+
    '<h1>📈 FinBuddy Expense Report</h1>'+
    '<p class="sub">Prepared for: '+(gUser&&gUser.displayName?esc(gUser.displayName):'User')+' &nbsp;|&nbsp; Period: '+label+' &nbsp;|&nbsp; Generated: '+new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})+'</p>'+
    '<div class="summary">'+
      '<div class="sum-box"><div class="sum-label">Total Spent</div><div class="sum-val">'+sym+total.toLocaleString('en-IN')+'</div></div>'+
      '<div class="sum-box"><div class="sum-label">Transactions</div><div class="sum-val">'+exp.length+'</div></div>'+
      '<div class="sum-box"><div class="sum-label">Avg per Day</div><div class="sum-val">'+sym+Math.round(total/Math.max(1,Math.round((new Date(to)-new Date(from))/86400000)+1)).toLocaleString('en-IN')+'</div></div>'+
    '</div>'+
    '<h2>Category Summary</h2>'+
    '<table><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead><tbody>'+catRows+'</tbody>'+
    '<tfoot><tr class="total-row"><td>Total</td><td style="text-align:right">'+sym+total.toLocaleString('en-IN')+'</td><td></td></tr></tfoot></table>'+
    '<h2>All Transactions</h2>'+
    '<table><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Note</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+rows+'</tbody>'+
    '<tfoot><tr class="total-row"><td colspan="4">Total</td><td style="text-align:right">'+sym+total.toLocaleString('en-IN')+'</td></tr></tfoot></table>'+
    '<div class="footer"><span>FinBuddy — Your Personal Finance Tracker</span><span>'+new Date().toLocaleString()+'</span></div>'+
    '<script>window.onload=function(){window.print();}<\/script></body></html>';

  var w = window.open('','_blank');
  if (!w) { showToast('Please allow popups to generate PDF','error'); return; }
  w.document.write(html);
  w.document.close();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});
}