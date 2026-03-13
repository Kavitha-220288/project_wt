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
- **Missing `FB_API_KEY`?** If your Firebase keys aren't in the `.env`, the frontend will fall back to default placeholders (which may not be authorized for you).
- **Budget Alerts not sending?** Ensure your `EMAILJS` credentials are correct in `.env`. You can create a free account at [emailjs.com](https://www.emailjs.com/).
- **AI Chatbot Fails?** Make sure you have a valid `OPENROUTER_KEY` and your account has free/paid credits left.
- **Port Conflict?** If another application is using port `3001`, open the `.env` file, change `PORT` to a different number (e.g., `8080`), and restart the server.

*Happy tracking!*
