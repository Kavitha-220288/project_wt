// js/ai_service.js — Walletly AI Service Handler

/**
 * Generates a dynamic system prompt based on user's current financial state.
 * Refined for high professionalism and strategic budget advice.
 */
function getSystemPrompt(expenses, userData, symbol) {
  var total = expenses.reduce((a, e) => a + Number(e.amount), 0);
  var budget = userData.budget || 0;
  var remain = budget - total;

  var catSummary = {};
  expenses.forEach(e => catSummary[e.category] = (catSummary[e.category] || 0) + Number(e.amount));

  var topCats = Object.entries(catSummary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(c => `${c[0]}: ${symbol}${c[1]}`)
    .join(', ');

  var recent = expenses.slice(0, 5)
    .map(e => `${e.date}: ${e.title} (${symbol}${e.amount})`)
    .join('; ');

  return `You are the Walletly Financial Executive, a sophisticated and professional AI budget strategist.
Your objective is to provide elite-level financial oversight and actionable wealth-management advice based on the user's data.

### Executive Overview:
- Currency: ${symbol}
- Monthly Allocation: ${symbol}${budget}
- Aggregate Expenditure: ${symbol}${total}
- Capital Remaining: ${symbol}${remain}
- Major Cost Centers: ${topCats || 'None identified'}
- Recent Transaction History: ${recent || 'No recent activity'}

### Professional Guidelines:
1. Precision: Base all insights strictly on provided data.
2. Strategy: Suggest medium-to-long term budget plans, emphasizing capital preservation.
3. Tone: Maintain a highly professional, authoritative yet encouraging executive tone.
4. Logic: If overspending is detected, prioritize debt avoidance and essential liquid asset protection.
5. Formatting: Use clear, structured responses. Use ${symbol} for all currency references.`;
}

/**
 * Generates professional email content using AI
 */
async function generateAIEmailContent(type, data) {
  const { symbol, budget, total, pct, expenses } = data;
  const prompt = `Act as an automated financial reporting system. Generate professional email content for a ${type} report.
Data: Total Spent: ${symbol}${total}, Budget: ${symbol}${budget}, Utilization: ${pct}%.
Instructions: 
1. Create a "Subject" and a "Body". 
2. The body should be highly professional, analyzing the user's spending of ${symbol}${total}. 
3. Provide 3 specific, professional bullet points for improvement.
4. Address the user formally.
Format: Return only the body text. I will use a separate subject line.`;

  try {
    const messages = [{ role: 'system', content: 'You are an elite financial reporter logic.' }, { role: 'user', content: prompt }];
    return await callOpenRouter(messages);
  } catch (err) {
    console.error('Failed to generate AI email:', err);
    return `Your ${type} financial report is ready. You have spent ${symbol}${total} of your ${symbol}${budget} budget (${Math.round(pct)}%). Please review your transactions in the dashboard.`;
  }
}

/**
 * Core function to call the AI Chat Proxy
 */
async function callOpenRouter(messages) {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Gateway error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error('AI Service Error:', err);
    throw err;
  }
}

/**
 * Fetches brief insights (used for the dashboard card)
 */
function getAIInsight(prompt, onSuccess, onError) {
  fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'system', content: 'You are a high-level financial analyst providing brief, punchy insights.' }, { role: 'user', content: prompt }]
    })
  })
  .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e.message || 'Insight Failed')))
  .then(d => onSuccess(d.choices[0].message.content))
  .catch(err => { console.error('Insight error:', err); onError(err); });
}

/**
 * THE EXPENSE AI MODEL
 */
class ExpenseAIModel {
  async parse(txt, fileBase64, fileType) {
    const res = await fetch('/api/ai/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txt, fileBase64, fileType })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Server Status: ${res.status}`);
    }

    const result = await res.json();
    const rawContent = result.data || (result.choices ? result.choices[0].message.content : result);
    
    if (typeof rawContent === 'string') {
      try {
        const match = rawContent.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : rawContent);
      } catch (e) {
        throw new Error('Data structure corruption in AI response.');
      }
    }
    return rawContent;
  }
}

const expenseAI = new ExpenseAIModel();
async function parseExpenseWithAI(txt, fileBase64, fileType) {
  return await expenseAI.parse(txt, fileBase64, fileType);
}
