// js/analytics.js — FinBuddy
var CAT_COLOR = {
  Food:'#ef4444', Travel:'#3b82f6', Shopping:'#f59e0b',
  Bills:'#8b5cf6', Entertainment:'#ec4899', Health:'#10b981',
  Education:'#06b6d4', Other:'#94a3b8'
};
var CAT_ICON = {
  Food:'🍔', Travel:'🚗', Shopping:'🛍', Bills:'💡',
  Entertainment:'🎬', Health:'❤️', Education:'📚', Other:'📦'
};

var gUser, gData, gExpenses = [];
var charts = {};
var activePeriod = 'week';

window.initTheme();

// Period dropdown change
document.getElementById('periodSelect').addEventListener('change', function(e) {
  activePeriod = e.target.value;
  buildCharts();
});

window.requireAuth(function(user, data) {
  gUser = user; gData = data;
  
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
    buildCharts();
  });
});

// ── Get date range for a period ──
function getRange(period) {
  var now  = new Date();
  var from, to = now.toISOString().slice(0,10);
  if (period === 'week') {
    var f = new Date(now); f.setDate(now.getDate()-6);
    from = f.toISOString().slice(0,10);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  } else if (period === '3month') {
    from = new Date(now.getFullYear(), now.getMonth()-2, 1).toISOString().slice(0,10);
  } else {
    from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0,10);
  }
  return { from: from, to: to };
}

// ── Get previous range (same length, prior period) ──
function getPrevRange(period) {
  var now  = new Date();
  var from, to;
  if (period === 'week') {
    var f = new Date(now); f.setDate(now.getDate()-13);
    var t = new Date(now); t.setDate(now.getDate()-7);
    from = f.toISOString().slice(0,10); to = t.toISOString().slice(0,10);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,10);
    to   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0,10);
  } else if (period === '3month') {
    from = new Date(now.getFullYear(), now.getMonth()-5, 1).toISOString().slice(0,10);
    to   = new Date(now.getFullYear(), now.getMonth()-2, 0).toISOString().slice(0,10);
  } else {
    from = new Date(now.getFullYear()-1, 0, 1).toISOString().slice(0,10);
    to   = new Date(now.getFullYear()-1, 11, 31).toISOString().slice(0,10);
  }
  return { from: from, to: to };
}

function filterByRange(range) {
  return gExpenses.filter(function(e){ return e.date >= range.from && e.date <= range.to; });
}

// ── Enumerate all dates between from→to ──
function dateRange(from, to) {
  var dates = [], cur = new Date(from+'T00:00:00');
  var end   = new Date(to+'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

function fmt(n) {
  var sym = gData.symbol||'₹';
  if (Math.abs(n) >= 100000) return sym+(n/100000).toFixed(1)+'L';
  if (Math.abs(n) >= 1000)   return sym+(n/1000).toFixed(1)+'K';
  return sym+Math.round(n).toLocaleString('en-IN');
}

function esc(s) {
  return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);});
}

function vsBadge(cur, prev, elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (prev === 0) { el.textContent = '—'; el.className = 'vs-badge down'; return; }
  var pct  = ((cur - prev) / prev * 100).toFixed(0);
  var isUp = cur >= prev;
  el.className = 'vs-badge ' + (isUp ? 'down' : 'up'); // spending up = bad
  el.textContent = (isUp ? '▼ ' : '▲ ') + Math.abs(pct) + '%';
}

// ── DRAW GAUGE (semicircle) ──
function drawGauge(canvasId, pct, color1, color2) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cx = W/2, cy = H-4, r = Math.min(W,H*2)*0.42;
  var isDark = !document.body.classList.contains('light');
  var trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  ctx.clearRect(0,0,W,H);
  // track
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.strokeStyle = trackColor;
  ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.stroke();

  // fill
  var angle = Math.PI + (Math.PI * Math.min(pct,1));
  var grad = ctx.createLinearGradient(cx-r, cy, cx+r, cy);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, angle, false);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.stroke();

  // needle
  var needleAngle = Math.PI + (Math.PI * Math.min(pct,1));
  var nx = cx + (r-2) * Math.cos(needleAngle);
  var ny = cy + (r-2) * Math.sin(needleAngle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = isDark ? '#e8edf8' : '#18203a';
  ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.stroke();
  // center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI*2);
  ctx.fillStyle = isDark ? '#e8edf8' : '#18203a';
  ctx.fill();
}

function buildCharts() {
  var sym    = gData.symbol || '₹';
  var budget = gData.budget || 0;
  var range  = getRange(activePeriod);
  var prev   = getPrevRange(activePeriod);
  var expenses     = filterByRange(range);
  var prevExpenses = filterByRange(prev);

  var total     = expenses.reduce(function(s,e){return s+Number(e.amount);},0);
  var prevTotal = prevExpenses.reduce(function(s,e){return s+Number(e.amount);},0);
  var balance   = budget - total;

  var isDark      = !document.body.classList.contains('light');
  var gridColor   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  var labelColor  = isDark ? '#6b7494' : '#556080';
  var cardBg      = isDark ? '#0f1320' : '#ffffff';
  Chart.defaults.color = labelColor;
  Chart.defaults.font.family = 'Sora, sans-serif';

  // ── Daily totals ──
  var dayTotals = {};
  expenses.forEach(function(e){ if(e.date) dayTotals[e.date]=(dayTotals[e.date]||0)+Number(e.amount); });

  var allDates = dateRange(range.from, range.to);
  var catTotals = {};
  expenses.forEach(function(e){ catTotals[e.category]=(catTotals[e.category]||0)+Number(e.amount); });

  // ─────────────────────────────────
  //  GAUGES
  // ─────────────────────────────────
  var spendPct   = budget>0 ? total/budget : 0;
  var balancePct = budget>0 ? Math.max(0, balance/budget) : 0.5;
  var cashPct    = budget>0 ? Math.min(Math.abs(total)/(budget*2), 1) : 0.5;

  drawGauge('gaugeBalance',  balancePct, '#34d399', '#06b6d4');
  drawGauge('gaugeCashflow', cashPct,    '#f87171', '#fb923c');
  drawGauge('gaugeSpending', Math.min(spendPct,1), '#f87171', '#ef4444');

  document.getElementById('gvBalance').textContent  = fmt(balance);
  document.getElementById('gvCashflow').textContent = '-'+fmt(total);
  document.getElementById('gvSpending').textContent = '-'+fmt(total);

  // ─────────────────────────────────
  //  BALANCE TREND
  // ─────────────────────────────────
  document.getElementById('btAmount').textContent = fmt(balance);
  document.getElementById('btAmount').style.color = balance>=0 ? 'var(--text)' : 'var(--danger)';
  vsBadge(total, prevTotal, 'btVsBadge');

  // cumulative balance per day: budget/days - cumulative spend
  var days = allDates.length || 1;
  var dailyBudgetAlloc = budget / 31; // approx daily alloc
  var cumulSpend = 0;
  var balanceData = allDates.map(function(d) {
    cumulSpend += (dayTotals[d]||0);
    return budget - cumulSpend;
  });

  destroy('trendChart');
  charts['trendChart'] = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: allDates.map(function(d){
        var dt = new Date(d+'T00:00:00');
        return dt.getDate()+' '+ dt.toLocaleDateString('en-IN',{month:'short'});
      }),
      datasets: [{
        data: balanceData,
        borderColor: '#3b82f6',
        backgroundColor: function(ctx) {
          var g = ctx.chart.ctx.createLinearGradient(0,0,0,130);
          g.addColorStop(0,'rgba(59,130,246,0.25)'); g.addColorStop(1,'rgba(59,130,246,0.0)'); return g;
        },
        fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
        borderWidth: 2, pointBackgroundColor: '#3b82f6'
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction: { mode:'index', intersect:false },
      plugins: { legend:{display:false}, tooltip:{
        callbacks:{ label:function(c){ return ' Balance: '+fmt(c.raw); } }
      }},
      scales: {
        x: { grid:{display:false}, ticks:{maxTicksLimit:6, font:{size:10}} },
        y: { grid:{color:gridColor}, ticks:{callback:function(v){return fmt(v);}, font:{size:10}} }
      }
    }
  });

  // ─────────────────────────────────
  //  EXPENSE STRUCTURE DONUT
  // ─────────────────────────────────
  document.getElementById('esTotal').textContent = (total>0?'-':'')+fmt(total);
  vsBadge(total, prevTotal, 'esVsBadge');

  var catEntries = Object.entries(catTotals).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
  destroy('esDonut');
  charts['esDonut'] = new Chart(document.getElementById('esDonut'), {
    type: 'doughnut',
    data: {
      labels: catEntries.map(function(e){return e[0];}),
      datasets:[{ data: catEntries.map(function(e){return e[1];}),
        backgroundColor: catEntries.map(function(e){return CAT_COLOR[e[0]]||'#94a3b8';}),
        borderWidth:2, borderColor: cardBg, hoverOffset:4 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{label:function(c){return ' '+c.label+': '+fmt(c.raw);}}} },
      animation:{ animateRotate:true, duration:800 }
    }
  });
  // center label plugin (inline)
  var esCanvas = document.getElementById('esDonut');
  esCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';

  var legend = document.getElementById('esLegend');
  legend.innerHTML = '';
  catEntries.forEach(function(en){
    legend.innerHTML += '<div class="es-leg-item"><div class="es-leg-name"><div class="es-leg-dot" style="background:'+(CAT_COLOR[en[0]]||'#94a3b8')+'"></div>'+en[0]+'</div><span class="es-leg-amt">'+fmt(en[1])+'</span></div>';
  });

  // ─────────────────────────────────
  //  METRIC CARDS
  // ─────────────────────────────────
  var daysCount = allDates.length || 1;
  var avg = total / daysCount;
  document.getElementById('mAvg').textContent = fmt(avg);
  document.getElementById('mAvgSub').textContent = daysCount + ' day period';
  document.getElementById('mAvgSub').className = 'mc-sub neutral';

  var topCat = Object.entries(catTotals).sort(function(a,b){return b[1]-a[1];})[0];
  document.getElementById('mTop').textContent = topCat ? (CAT_ICON[topCat[0]]||'') + ' ' + topCat[0] : '—';
  document.getElementById('mTopSub').textContent = topCat ? fmt(topCat[1]) : '—';

  var peakDay = Object.entries(dayTotals).sort(function(a,b){return b[1]-a[1];})[0];
  document.getElementById('mPeak').textContent = peakDay ? fmt(peakDay[1]) : '—';
  document.getElementById('mPeakSub').textContent = peakDay ? new Date(peakDay[0]+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—';

  var saveRate = budget>0 ? Math.max(0,(budget-total)/budget*100) : 0;
  document.getElementById('mSave').textContent = saveRate.toFixed(1) + '%';
  document.getElementById('mSaveSub').className = 'mc-sub ' + (saveRate>20?'up':saveRate>0?'neutral':'down');
  document.getElementById('mSaveSub').textContent = saveRate>20?'💚 On track':saveRate>0?'⚠️ Getting close':'🔴 Over budget';

  document.getElementById('mTxns').textContent = expenses.length;
  document.getElementById('mTxnSub').textContent = prevExpenses.length + ' last period';
  document.getElementById('mTxnSub').className = 'mc-sub neutral';

  var biggest = expenses.slice().sort(function(a,b){return Number(b.amount)-Number(a.amount);})[0];
  document.getElementById('mBiggest').textContent = biggest ? fmt(Number(biggest.amount)) : '—';
  document.getElementById('mBiggestSub').textContent = biggest ? esc(biggest.title) : '—';

  // ─────────────────────────────────
  //  DAILY BAR CHART (last 30 days)
  // ─────────────────────────────────
  var last30 = dateRange(range.from, range.to).slice(-30);
  var barColors = last30.map(function(d){
    var v = dayTotals[d]||0;
    if (v===0) return isDark?'rgba(91,124,250,0.15)':'rgba(91,124,250,0.12)';
    return v > avg*2 ? '#f87171' : '#6366f1';
  });
  destroy('barChart');
  charts['barChart'] = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: last30.map(function(d){ var dt=new Date(d+'T00:00:00'); return dt.getDate()+''; }),
      datasets:[{ data: last30.map(function(d){return dayTotals[d]||0;}),
        backgroundColor: barColors, borderRadius:4, borderSkipped:false }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:function(c){return ' '+fmt(c.raw);}}} },
      scales:{
        x:{grid:{display:false}, ticks:{font:{size:10}}},
        y:{grid:{color:gridColor}, ticks:{callback:function(v){return fmt(v);}, font:{size:10}}}
      }
    }
  });

  // ─────────────────────────────────
  //  CATEGORY RANKING
  // ─────────────────────────────────
  var maxCatVal = topCat ? topCat[1] : 1;
  var allCatSorted = Object.entries(catTotals).sort(function(a,b){return b[1]-a[1];});
  var rankEl = document.getElementById('catRankList');
  rankEl.innerHTML = '';
  if (!allCatSorted.length) {
    rankEl.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:1rem;text-align:center">No data for this period</div>';
  } else {
    allCatSorted.forEach(function(en, i){
      var pct = (en[1]/total*100).toFixed(0);
      var barW = (en[1]/maxCatVal*100).toFixed(1);
      var color = CAT_COLOR[en[0]]||'#94a3b8';
      rankEl.innerHTML +=
        '<div class="cat-rank-item">'+
        '<span class="cat-rank-num">'+(i+1)+'</span>'+
        '<div class="cat-rank-icon" style="background:'+color+'22">'+CAT_ICON[en[0]]+'</div>'+
        '<div class="cat-rank-info">'+
          '<div class="cat-rank-name">'+en[0]+'</div>'+
          '<div class="cat-rank-bar-bg"><div class="cat-rank-bar-fill" style="width:'+barW+'%;background:'+color+'"></div></div>'+
        '</div>'+
        '<div style="text-align:right">'+
          '<div class="cat-rank-amt">'+fmt(en[1])+'</div>'+
          '<div class="cat-rank-pct">'+pct+'%</div>'+
        '</div>'+
        '</div>';
    });
  }



  // ─────────────────────────────────
  //  TOP TABLE
  // ─────────────────────────────────
  var sorted = expenses.slice().sort(function(a,b){return Number(b.amount)-Number(a.amount);}).slice(0,10);
  document.getElementById('topCount').textContent = sorted.length + ' items';
  var tbody = document.getElementById('topTable');
  tbody.innerHTML = '';
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No data for this period</td></tr>';
    return;
  }
  var medals = ['🥇','🥈','🥉'];
  sorted.forEach(function(e, i){
    var date = e.date ? new Date(e.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '';
    var rank = medals[i] || '#'+(i+1);
    tbody.innerHTML += '<tr>'+
      '<td><span class="rank-badge" style="background:'+(CAT_COLOR[e.category]||'#94a3b8')+'22;color:'+(CAT_COLOR[e.category]||'#94a3b8')+'">'+rank+'</span></td>'+
      '<td style="font-weight:500">'+esc(e.title)+'</td>'+
      '<td class="td-cat">'+(CAT_ICON[e.category]||'')+' '+esc(e.category)+'</td>'+
      '<td style="color:var(--muted)">'+date+'</td>'+
      '<td class="td-amount">'+sym+Number(e.amount).toLocaleString('en-IN')+'</td>'+
      '</tr>';
  });
}

function destroy(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}