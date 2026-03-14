# 🚀 Walletly — Quick Start Guide

Follow these simple steps to launch the modern Walletly full-stack expense tracker.

---

## 1. Prerequisites
You need **Node.js** installed on your system.
- Check by running `node -v` in your terminal.
- If not installed, download it from [nodejs.org](https://nodejs.org/).

## 2. Installation
Open your terminal in the `project_wt` folder (where this file is located) and install the backend dependencies:
```bash
npm install
```
*This installs Express, Axios, CORS, Dotenv, and Morgan for the backend API proxy.*

## 3. Configuration
1. Rename `.env.example` to `.env` (or create a new `.env` file).
2. Inside `.env`, provide your API credentials. It should look like this:

```env
# Firebase Configuration
FB_API_KEY=your-firebase-api-key
FB_AUTH_DOMAIN=your-auth-domain
FB_DB_URL=your-database-url
FB_PROJECT_ID=your-project-id
FB_STORAGE_BUCKET=your-bucket
FB_MSG_SENDER_ID=your-sender-id
FB_APP_ID=your-app-id

# AI API Keys
OPENROUTER_KEY=your-openrouter-key
OPENROUTER_MODEL=arcee-ai/trinity-large-preview:free

# EmailJS Configuration (Smart Alerts)
EMAILJS_SERVICE_ID=your-service-id
EMAILJS_TEMPLATE_ID=your-template-id
EMAILJS_PUBLIC_KEY=your-public-key

# Optional (If you want faster image scanning)
GEMINI_API_KEY=your-gemini-key

# Server Port
PORT=3001
```

## 4. Launching the App
Start the node server from your terminal:
```bash
npm start
# or for live reloading:
npm run dev
```

You should see an output similar to: `🚀 Walletly Server running at http://localhost:3001`

## 5. View your Application
Open your web browser and navigate to:
👉 **[http://localhost:3001](http://localhost:3001)**

---

## 📂 Troubleshooting & Tips

### ✉️ Setting up EmailJS (Budget Alerts)
1. Go to [EmailJS.com](https://www.emailjs.com/) and create a free account.
2. **Add Service**: Link your Gmail/Outlook and copy the **Service ID**.
3. **Add Template**: Create a template for budget alerts and copy the **Template ID**.
4. **Public Key**: Find your **Public Key** in your account settings.
5. Paste these into your `.env` file as shown in section 3.

### 🔄 The "First Page" Issue
If you run `npm start` and see a login page instead of the landing page:
- Make sure you don't have an `index.html` file in the root directory. 
- Walletly uses `landing.html` as the default home page.
- Our customized Express server handles the routing to ensure a professional flow.

### 🤖 AI Chatbot Fails
- Ensure you have a valid **OpenRouter API Key**.
- If one model is slow, you can switch the `OPENROUTER_MODEL` in your `.env` to a different one (e.g., `google/gemini-2.0-flash-lite:free`).

### 📸 Receipt Scanning
- If receipt scanning is slow, configure the optional `GEMINI_API_KEY` in your `.env`. It utilizes Google's native vision models for lightning-fast parsing.

---

*Happy tracking! Your financial universe awaits.*
