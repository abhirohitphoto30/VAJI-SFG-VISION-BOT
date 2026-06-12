# 🤖 VAJI + SFG + VISION BOT

A unified, all-in-one Telegram bot for UPSC aspirants — combining **two powerful tools** in one place.

---

## 📦 What's Inside

This repository merges two bots:

| Source Repo | Features |
|---|---|
| [`txtbot`](https://github.com/abhirohitphoto30/txtbot) | .txt file blank-line remover + format converter |
| [`upsc-pdf-bot`](https://github.com/abhirohitphoto30/upsc-pdf-bot) | UPSC PDF → TXT converter (SFG, Vajiram, VisionIAS) |

---

## ✨ Features

### 📄 Module 1 — UPSC PDF Converter

Converts UPSC test-series PDFs into perfectly formatted `.txt` files:

- ⚡ **ForumIAS SFG** — 50 Questions (single Solutions PDF)
- ⚙️ **Vajiram & Ravi** — 100 Questions (Test Booklet + Solutions PDF)
- 🔮 **VisionIAS** — 100 Questions (Test PDF + Solution PDF)

Each output file includes:
- Correct answers marked with ✅
- Explanations prefixed with `Ex:`
- 😂 separator between question stem and options
- Clean numbering format (`Q1.`, `Q2.`, ...)

### 📝 Module 2 — TXT File Fixer

Fixes question bank `.txt` files:

- 🔹 **Auto Blank Line Remover** — just send any `.txt` file!
- 🔹 **Format Converter** (`/txt`) — WRONG inline format → CORRECT multi-line format
- 🔹 **Emoji Points Expander** — `1️⃣2️⃣3️⃣` inline → separate lines

---

## ⌨️ Commands

| Command | Description | Example |
|---|---|---|
| `/start` | Start the bot — shows welcome screen + all options | `/start` |
| `/help` | Complete help guide with all commands and usage examples | `/help` |
| `/menu` | Go back to main PDF converter menu | `/menu` |
| `/txt` | Activate TXT Format Converter mode — then send your .txt file | `/txt` |
| `/about` | Bot info — version, features, platform details | `/about` |

---

## 🚀 Quick Start

### Local Development (Polling Mode)

1. Clone this repo:
   ```bash
   git clone https://github.com/abhirohitphoto30/VAJI-SFG-VISION-BOT.git
   cd VAJI-SFG-VISION-BOT
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```env
   BOT_TOKEN=your_telegram_bot_token_here
   ```

4. Run the bot:
   ```bash
   npm run dev
   # or: node start.js
   ```

---

### Production Deployment (Vercel Webhook)

1. Deploy to Vercel:
   ```bash
   npm run deploy
   # or: vercel --prod
   ```

2. Register the webhook:
   ```bash
   VERCEL_URL=your-app.vercel.app node setup.js
   ```

> ⚠️ **Vercel Hobby plan** has a 10-second function timeout — large PDFs may time out. Use **Vercel Pro** (60s+) or run in polling mode (`node start.js`) for heavy usage.

---

## 🔧 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ Yes | Telegram Bot Token from [@BotFather](https://t.me/BotFather) |
| `VERCEL_URL` | Webhook only | Your Vercel deployment URL (for `setup.js`) |

---

## 📁 Project Structure

```
VAJI-SFG-VISION-BOT/
├── api/
│   └── webhook.js          — Vercel serverless webhook endpoint
├── lib/
│   ├── api.js              — Telegram API helpers (sendMessage, sendDocument, etc.)
│   ├── bot.js              — Unified bot router (merged main handler)
│   ├── sfg.js              — ForumIAS SFG PDF parser (50 Q)
│   ├── vajiram.js          — Vajiram & Ravi PDF parser (100 Q)
│   ├── vision.js           — VisionIAS PDF parser (100 Q)
│   └── txtfixer.js         — TXT blank-line remover + format converter
├── start.js                — Polling mode runner (for local/non-webhook deployment)
├── setup.js                — One-time webhook registration script
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

---

## 🔒 Privacy

- No AI or external APIs used — everything runs with pure JavaScript, regex, and [PDF.js](https://mozilla.github.io/pdf.js/)
- Files are **never stored permanently** — processed in memory and discarded immediately
- Your data stays private

---

## 📋 How to Use (Step-by-Step)

### ForumIAS SFG
1. Send `/start` or `/menu`
2. Tap **"⚡ ForumIAS SFG (50 Q)"**
3. Send the **Solutions PDF** as a document
4. Receive your formatted `.txt` file ✅

### Vajiram & Ravi
1. Send `/start` or `/menu`
2. Tap **"⚙️ Vajiram & Ravi (100 Q)"**
3. Send the **Test Booklet PDF** first
4. Send the **Solutions PDF** next
5. Receive your formatted `.txt` file ✅

### VisionIAS
1. Send `/start` or `/menu`
2. Tap **"🔮 VisionIAS (100 Q)"**
3. Send the **Test PDF** first
4. Send the **Solution PDF** next
5. Receive your formatted `.txt` file ✅

### TXT Blank Line Remover
- Just send any `.txt` file directly — bot auto-detects and removes extra blank lines!

### TXT Format Converter
1. Send `/txt`
2. Send your WRONG-format `.txt` file
3. Receive the CORRECT-format file ✅

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **PDF Parsing**: [pdf.js-dist](https://www.npmjs.com/package/pdfjs-dist) v3.11
- **Hosting**: [Vercel](https://vercel.com) Serverless Functions
- **Bot API**: Telegram Bot API (via direct fetch)
- **Text Processing**: Pure Regex / String Manipulation (No AI)

---

*Made with ❤️ for UPSC aspirants*
