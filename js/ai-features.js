// js/ai-features.js

// ── Voice Tracking ──
window.startVoiceTracking = function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Speech Recognition not supported in this browser.', 'error');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;

  showToast('Listening... e.g., "Add 500 for food"', 'success');

  recognition.onresult = function (event) {
    const text = event.results[0][0].transcript;
    showToast('Heard: ' + text, '');
    processVoiceCommand(text);
  };

  recognition.onerror = function (event) {
    showToast('Voice error: ' + event.error, 'error');
  };

  recognition.start();
};

function processVoiceCommand(text) {
  // Regex to extract amount and category
  // e.g., "Add 200 rupees for food", "spent 50 on travel"
  const amountMatch = text.match(/(\d+)/);
  const lowerText = text.toLowerCase();

  const keywordMap = {
    'food': 'Food', 'zomato': 'Food', 'swiggy': 'Food', 'restaurant': 'Food', 'dinner': 'Food', 'lunch': 'Food', 'breakfast': 'Food', 'grocery': 'Food', 'groceries': 'Food', 'pizza': 'Food', 'burger': 'Food',
    'travel': 'Travel', 'uber': 'Travel', 'ola': 'Travel', 'bus': 'Travel', 'train': 'Travel', 'flight': 'Travel', 'ticket': 'Travel', 'cab': 'Travel', 'auto': 'Travel', 'petrol': 'Travel', 'fuel': 'Travel',
    'shopping': 'Shopping', 'clothes': 'Shopping', 'shirt': 'Shopping', 'shoes': 'Shopping', 'amazon': 'Shopping', 'flipkart': 'Shopping', 'mall': 'Shopping', 'myntra': 'Shopping', 'dress': 'Shopping',
    'bills': 'Bills', 'electricity': 'Bills', 'water': 'Bills', 'internet': 'Bills', 'wifi': 'Bills', 'recharge': 'Bills', 'mobile': 'Bills', 'phone': 'Bills', 'rent': 'Bills',
    'entertainment': 'Entertainment', 'movie': 'Entertainment', 'cinema': 'Entertainment', 'netflix': 'Entertainment', 'prime': 'Entertainment', 'games': 'Entertainment', 'concert': 'Entertainment',
    'health': 'Health', 'doctor': 'Health', 'medicine': 'Health', 'pharmacy': 'Health', 'hospital': 'Health', 'clinic': 'Health', 'medical': 'Health',
    'education': 'Education', 'school': 'Education', 'college': 'Education', 'books': 'Education', 'stationery': 'Education', 'course': 'Education', 'tuition': 'Education', 'fees': 'Education'
  };

  let foundCat = 'Other';

  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (lowerText.includes(keyword)) {
      foundCat = category;
      break;
    }
  }

  if (foundCat === 'Other') {
    const categories = ['Food', 'Travel', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'];
    categories.forEach(cat => {
      if (lowerText.includes(cat.toLowerCase())) foundCat = cat;
    });
  }

  if (amountMatch) {
    const amount = amountMatch[1];
    const title = text.length > 20 ? text.substring(0, 20) + '...' : text;

    // Auto-open modal with values
    openModal();
    document.getElementById('expTitle').value = 'Voice: ' + title;
    document.getElementById('expAmount').value = amount;
    document.getElementById('expCat').value = foundCat;
    showToast('Extracted: ₹' + amount + ' for ' + foundCat, 'success');
  } else {
    showToast('Could not extract amount. Please try again.', 'error');
  }
}

// ── Receipt OCR ──
window.processReceiptOCR = function (file) {
  if (!file) return;

  showToast('Scanning receipt... Please wait', 'success');

  Tesseract.recognize(file, 'eng', {
    logger: m => console.log(m)
  }).then(({ data: { text } }) => {
    console.log("OCR Result:", text);
    extractReceiptData(text);
  }).catch(err => {
    showToast('OCR Error: ' + err.message, 'error');
  });
};

function extractReceiptData(text) {
  // Look for total amount patterns like "Total: 123.45" or "Amount: 123"
  const lines = text.split('\n');
  let total = 0;

  // Simple heuristic: look for weights/numbers near terms like 'Total', 'Net', 'Amount'
  const regex = /(total|amount|net|sum|paid)[\s:]*([₹$]?\s*\d+[.,]\d{2})/i;
  const match = text.match(regex);

  if (match) {
    total = match[2].replace(/[^\d.]/g, '');
  } else {
    // Fallback: look for the largest number in the text (often the total)
    const numbers = text.match(/\d+[.,]\d{2}/g);
    if (numbers) {
      const parsedNumbers = numbers.map(n => parseFloat(n.replace(',', '')));
      total = Math.max(...parsedNumbers);
    }
  }

  if (total) {
    openModal();
    document.getElementById('expTitle').value = 'Receipt Scan';
    document.getElementById('expAmount').value = total;
    document.getElementById('expCat').value = 'Shopping'; // Default
    showToast('Extracted ₹' + total + ' from receipt', 'success');
  } else {
    showToast('Could not find total amount on receipt.', 'error');
  }
}

// ── Chatbot ──
window.toggleChat = function () {
  document.getElementById('chatbotWrap').classList.toggle('open');
};

window.sendChat = function () {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  appendMsg(text, 'user');
  input.value = '';

  // Process command
  setTimeout(() => {
    const response = handleChatResponse(text.toLowerCase());
    appendMsg(response, 'bot');
  }, 600);
};

function appendMsg(text, sender) {
  const body = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'msg ' + sender;
  div.innerText = text;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function handleChatResponse(text) {
  const totalSpent = gExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const sym = gData.symbol || '₹';

  if (text.includes('spent') || text.includes('how much')) {
    if (text.includes('food')) {
      const foodTotal = gExpenses.filter(e => e.category === 'Food').reduce((s, e) => s + Number(e.amount), 0);
      return `You've spent ${sym}${foodTotal.toLocaleString()} on food this month.`;
    }
    return `You have spent a total of ${sym}${totalSpent.toLocaleString()} this month.`;
  }

  if (text.includes('budget')) {
    const budget = gData.budget || 0;
    const remaining = budget - totalSpent;
    return `Your monthly budget is ${sym}${budget.toLocaleString()}. You have ${sym}${remaining.toLocaleString()} left.`;
  }

  if (text.includes('hi') || text.includes('hello')) {
    return "Hello! I'm your AI assistant. Ask me about your spending habits!";
  }

  if (text.includes('insight') || text.includes('suggest')) {
    const topCat = getTopCategory();
    if (topCat) {
      return `Insight: Your highest spending is on ${topCat}. You might want to cut down there!`;
    }
  }

  return "I'm still learning! Try asking 'How much did I spend on food?' or 'What is my budget?'";
}

function getTopCategory() {
  const catTotals = {};
  gExpenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount); });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}
