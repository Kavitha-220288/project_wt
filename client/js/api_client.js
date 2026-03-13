// client/js/api_client.js — Walletly API Client

const API_BASE = '/api/ai';

const ApiClient = {
  /**
   * Send a chat message to the backend proxy
   */
  async chat(messages, model) {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model })
    });
    if (!response.ok) throw new Error('Chat API failed');
    return await response.json();
  },

  /**
   * Parse an expense (text or image) using the backend proxy
   */
  async parse(data) {
    const response = await fetch(`${API_BASE}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Parse API failed');
    return await response.json();
  }
};

window.ApiClient = ApiClient;
