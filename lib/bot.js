/**
 * Core bot handler — unified router for VAJI + SFG + VISION BOT
 *
 * Combines:
 *   1. UPSC PDF → TXT Converter (ForumIAS SFG, Vajiram & Ravi, VisionIAS)
 *      — from: abhirohitphoto30/upsc-pdf-bot
 *   2. Question File Fixer (.txt blank-line remover + format converter)
 *      — from: abhirohitphoto30/txtbot
 *
 * All original functions are preserved unchanged.
 * Only routing / session logic is added to connect them under one bot.
 */

const { sendMessage, sendDocument, sendChatAction, editMessageText, answerCallbackQuery } = require('./api');
const { processSfg } = require('./sfg');
const { processVajiram } = require('./vajiram');
const { processVision } = require('./vision');
const { fixQuestionsFile, countQuestions, convertFormat } = require('./txtfixer');

// ── In-memory session store ──────────────────────────────────────────
/** @type {Map<string, { mode: string, files: { test?: Buffer, sol?: Buffer } }>} */
const sessions = new Map();

// ── In-memory user state (for /txt multi-step flow) ──────────────────
const userState = {};

// ── Telegram File Download ────────────────────────────────────────────
async function downloadFile(fileId) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const fileInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`).then(r => r.json());
  if (!fileInfo.ok) throw new Error(`getFile failed: ${fileInfo.description}`);
  const filePath = fileInfo.result.file_path;
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// ── Keyboard helpers ──────────────────────────────────────────────────
function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '⚡ ForumIAS SFG (50 Q)', callback_data: 'mode:sfg' }],
      [{ text: '⚙️ Vajiram & Ravi (100 Q)', callback_data: 'mode:vajiram' }],
      [{ text: '🔮 VisionIAS (100 Q)', callback_data: 'mode:vision' }],
      [{ text: '📝 TXT File Fixer', callback_data: 'show_txt_menu' }],
    ],
  };
}

function backKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '↩️ Back to Menu', callback_data: 'menu' }],
    ],
  };
}

function txtMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔄 Format Converter (/txt)', callback_data: 'show_txt' }],
      [{ text: '↩️ Back to Menu', callback_data: 'menu' }],
    ],
  };
}

// ── /start welcome message ────────────────────────────────────────────
async function handleStart(chatId, firstName) {
  const name = firstName || 'User';
  await sendMessage(chatId,
`╔══════════════════════════════════╗
  🤖 <b>VAJI + SFG + VISION BOT</b>
╚══════════════════════════════════╝

Namaste <b>${name}</b>! 👋 Swagat hai!

Main ek <b>all-in-one Telegram bot</b> hoon — UPSC ke liye banaya gaya. Do powerful tools ek jagah:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 <b>MODULE 1 — UPSC PDF Converter</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UPSC test-series PDFs ko perfectly formatted <code>.txt</code> files mein convert karta hoon:

⚡ <b>ForumIAS SFG</b> — 50 Q (single Solutions PDF)
⚙️ <b>Vajiram &amp; Ravi</b> — 100 Q (Test + Solutions PDFs)
🔮 <b>VisionIAS</b> — 100 Q (Test + Solutions PDFs)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>MODULE 2 — TXT File Fixer</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question bank <code>.txt</code> files fix karta hoon:

🔹 <b>Blank Line Remover</b> — auto (bas file bhejo!)
🔹 <b>Format Converter</b> — WRONG → CORRECT format
🔹 <b>Emoji Points Expand</b> — 1️⃣2️⃣3️⃣ → alag lines

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 <b>Shuru karo:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 <b>PDF bhejo</b> → PDF Converter (choose mode below)
📝 <b>.txt file bhejo</b> → Auto blank-line fix
🔄 /txt → Format Converter mode

<i>Version: 1.0 | Platform: Vercel Serverless</i>`,
    { reply_markup: mainKeyboard() }
  );
}

// ── /help message ─────────────────────────────────────────────────────
async function handleHelp(chatId) {
  await sendMessage(chatId,
`📖 <b>VAJI + SFG + VISION BOT — Complete Help</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⌨️ <b>ALL COMMANDS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/start — Bot start karo, welcome screen + menu
  <i>Example: /start → Buttons dikhenge</i>

/help — Ye complete help guide
  <i>Example: /help → Sabhi commands ki info</i>

/menu — PDF converter ka main menu
  <i>Example: /menu → SFG / Vajiram / VisionIAS choose karo</i>

/txt — TXT Format Converter mode activate karo
  <i>Example: /txt → Bot file ka wait karega; tab apni .txt file bhejo</i>

/about — Bot ke baare mein info
  <i>Example: /about → Version, features, details</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 <b>PDF CONVERTER — HOW TO USE:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>⚡ ForumIAS SFG (50 Questions)</b>
1️⃣ /start ya /menu bhejo
2️⃣ "ForumIAS SFG" button dabao
3️⃣ Solutions PDF bhejo
4️⃣ Formatted .txt file milegi ✅

<b>⚙️ Vajiram &amp; Ravi (100 Questions)</b>
1️⃣ /start ya /menu bhejo
2️⃣ "Vajiram &amp; Ravi" button dabao
3️⃣ Test Booklet PDF bhejo
4️⃣ Solutions PDF bhejo
5️⃣ Formatted .txt file milegi ✅

<b>🔮 VisionIAS (100 Questions)</b>
1️⃣ /start ya /menu bhejo
2️⃣ "VisionIAS" button dabao
3️⃣ Test PDF bhejo
4️⃣ Solution PDF bhejo
5️⃣ Formatted .txt file milegi ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>TXT FIXER — HOW TO USE:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🔹 Auto Blank Line Remover:</b>
Seedha apni <code>.txt</code> file bhejo — bot automatically fix kar dega!
<i>Max size: 20 MB | Format: UTF-8 .txt</i>

<b>🔹 Format Converter (/txt):</b>
WRONG (inline):
<code>Q.1) Consider: 1️⃣ Point A 2️⃣ Point B How many?
Option A
Option B ✅</code>

CORRECT (formatted):
<code>Q.1) Consider:
1️⃣ Point A
2️⃣ Point B
How many?
😂
Option A
Option B ✅</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>TIPS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• PDF files → Document ke roop mein bhejo (Gallery nahi!)
• TXT files → Sirf .txt format support hai
• PDF size limit: 50 MB | TXT size limit: 20 MB
• Apni files safe hain — permanently store nahi hoti`,
    { reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu' }]] } }
  );
}

// ── /about message ────────────────────────────────────────────────────
async function handleAbout(chatId) {
  await sendMessage(chatId,
`╔══════════════════════════════════╗
  ℹ️ <b>About VAJI + SFG + VISION BOT</b>
╚══════════════════════════════════╝

🤖 <b>Name:</b> VAJI + SFG + VISION BOT
🏷️ <b>Version:</b> 1.0 — Merged Edition
☁️ <b>Platform:</b> Vercel Serverless
⚡ <b>Engine:</b> Pure Regex / PDF.js / Node.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>PDF Converter Features:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✔️ ForumIAS SFG — 50 Questions
✔️ Vajiram &amp; Ravi — 100 Questions
✔️ VisionIAS — 100 Questions
✔️ Auto correct answer marking ✅
✔️ Explanation extraction (Ex:)
✔️ Question numbering fix
✔️ 50 MB PDF size support

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>TXT Fixer Features:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✔️ Blank line removal (auto)
✔️ Question count detection
✔️ File statistics &amp; report
✔️ Format conversion (No AI!)
✔️ 1️⃣2️⃣3️⃣ emoji points expansion
✔️ 😂 separator auto-add
✔️ 20 MB TXT file support

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 <b>Privacy:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ye bot koi AI ya external API use nahi karta. Sab kuch pure JavaScript regex aur PDF.js se hota hai. Aapki files permanently store nahi hoti.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<i>Made with ❤️ for UPSC aspirants</i>`,
    { reply_markup: { inline_keyboard: [
      [{ text: '📖 Help Guide', callback_data: 'show_help' }, { text: '🏠 Menu', callback_data: 'menu' }]
    ]} }
  );
}

// ── /txt prompt ───────────────────────────────────────────────────────
const TXT_PROMPT_TEXT = `
🔄 <b>Format Converter</b> — <code>/txt</code>

<b>Pure Regex Logic • Zero AI • Instant ⚡</b>

━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Kya karta hai ye?</b>
━━━━━━━━━━━━━━━━━━━━━━━

WRONG format wali file ko CORRECT format mein convert karta hai. Koi AI use nahi hoti — 100% pure regex!

━━━━━━━━━━━━━━━━━━━━━━━
❌ <b>WRONG format (inline points):</b>
━━━━━━━━━━━━━━━━━━━━━━━
<code>Q.1) Consider the following: 1️⃣ Point one 2️⃣ Point two How many?
Option A
Option B ✅
Ex: Explanation here.</code>

━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>CORRECT format (alag lines + separator):</b>
━━━━━━━━━━━━━━━━━━━━━━━
<code>Q.1) Consider the following:
1️⃣ Point one
2️⃣ Point two
How many?
😂
Option A
Option B ✅
Ex: Explanation here.</code>

━━━━━━━━━━━━━━━━━━━━━━━
📤 <b>Ab apni WRONG format wali <code>.txt</code> file bhejo!</b>
━━━━━━━━━━━━━━━━━━━━━━━

<i>Cancel karne ke liye /start dabao</i>
`.trim();

// ── Command: /menu ────────────────────────────────────────────────────
async function handleMenu(chatId) {
  sessions.delete(chatId);
  delete userState[chatId];
  await sendMessage(chatId,
`🏠 <b>Main Menu — VAJI + SFG + VISION BOT</b>

Ek converter choose karo ya TXT Fixer use karo:`,
    { reply_markup: mainKeyboard() }
  );
}

// ── Callback query handler ────────────────────────────────────────────
async function handleCallback(chatId, msgId, data, callbackQueryId, firstName) {
  if (callbackQueryId) {
    await answerCallbackQuery(callbackQueryId);
  }

  if (data === 'menu') {
    sessions.delete(chatId);
    delete userState[chatId];
    await editMessageText(chatId, msgId,
`🏠 <b>Main Menu — VAJI + SFG + VISION BOT</b>

Ek converter choose karo ya TXT Fixer use karo:`,
      { reply_markup: mainKeyboard() }
    );
    return;
  }

  if (data === 'show_help') {
    await editMessageText(chatId, msgId, '📖 Help guide aa raha hai...', {});
    await handleHelp(chatId);
    return;
  }

  if (data === 'show_txt_menu') {
    await editMessageText(chatId, msgId,
`📝 <b>TXT File Fixer</b>

Kya karna chahte ho?`,
      { reply_markup: txtMenuKeyboard() }
    );
    return;
  }

  if (data === 'show_txt') {
    userState[chatId] = 'waiting_for_txt_file';
    await editMessageText(chatId, msgId, TXT_PROMPT_TEXT,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'menu' }]] } }
    );
    return;
  }

  // ── Mode selection (PDF converters) ──
  const modeMatch = data.match(/^mode:(\w+)$/);
  if (modeMatch) {
    const mode = modeMatch[1];
    sessions.set(chatId, { mode, files: {} });
    delete userState[chatId];

    if (mode === 'sfg') {
      await editMessageText(chatId, msgId,
`⚡ <b>ForumIAS SFG Converter</b> (50 Questions)

📄 <b>Apna Solutions PDF bhejo.</b>

Bot sabhi 50 questions correct answers ✅ aur explanations ke saath extract karega, phir formatted .txt file dega.

💡 <i>Single PDF — sirf solutions file bhejo.</i>`,
        { reply_markup: backKeyboard() }
      );
    } else if (mode === 'vajiram') {
      await editMessageText(chatId, msgId,
`⚙️ <b>Vajiram &amp; Ravi Converter</b> (100 Questions)

📝 <b>Step 1 of 2 —</b> <b>Test Booklet PDF</b> bhejo (questions).
📄 <b>Step 2 of 2 —</b> <b>Solutions PDF</b> bhejo (answers + explanations).

Dono kisi bhi order mein bhej sakte ho — bot auto-detect karega.

⏳ <i>Files ka wait kar raha hoon…</i>`,
        { reply_markup: backKeyboard() }
      );
    } else if (mode === 'vision') {
      await editMessageText(chatId, msgId,
`🔮 <b>VisionIAS Converter</b> (100 Questions)

📋 <b>Step 1 of 2 —</b> <b>Test PDF</b> bhejo (question booklet).
💡 <b>Step 2 of 2 —</b> <b>Solution PDF</b> bhejo (answers + explanations).

Ek ke baad ek bhejo — bot detect kar lega.

⏳ <i>Files ka wait kar raha hoon…</i>`,
        { reply_markup: backKeyboard() }
      );
    }
    return;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  TXT FILE HANDLER (from txtbot — all original logic unchanged)
// ═══════════════════════════════════════════════════════════════════════
async function handleTxtFile(chatId, document, isFormatConvert) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;
  const fileName = document.file_name ?? 'file.txt';
  const fileSize = document.file_size ?? 0;

  if (!fileName.toLowerCase().endsWith('.txt')) {
    await sendMessage(chatId,
      `❌ <b>Galat format!</b>\n\n<code>${fileName}</code> supported nahi hai.\n\nSirf <b>.txt</b> files bhejo.\n\n<i>/help se guide dekho.</i>`,
      { reply_markup: { inline_keyboard: [[{ text: '📖 Guide', callback_data: 'show_help' }]] } }
    );
    return;
  }

  if (fileSize > 20 * 1024 * 1024) {
    await sendMessage(chatId,
      `❌ <b>File too large!</b>\n\nMax size <b>20 MB</b> hai.\n\nApni file split karke bhejo.`,
      { reply_markup: { inline_keyboard: [[{ text: '🏠 Menu', callback_data: 'menu' }]] } }
    );
    return;
  }

  const BOT_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

  if (isFormatConvert) {
    // /txt mode — Format Converter
    delete userState[chatId];

    const processingRes = await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⏳ <b>Converting Format...</b>\n\n📄 <b>File:</b> <code>${fileName}</code>\n📦 <b>Size:</b> ${(fileSize / 1024).toFixed(1)} KB\n\n🔄 <i>Pure regex se format ho rahi hai...</i>\n⚡ <i>Koi AI nahi — 100% local logic!</i>`,
        parse_mode: 'HTML',
      }),
    });
    const processingMsg = await processingRes.json();
    const processingMsgId = processingMsg?.result?.message_id;

    try {
      const fileInfoRes = await fetch(`${BOT_URL}/getFile?file_id=${document.file_id}`);
      const fileInfo = await fileInfoRes.json();

      if (!fileInfo.ok) {
        await fetch(`${BOT_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: processingMsgId, text: `❌ <b>Download failed!</b>\n\nDobara try karo.`, parse_mode: 'HTML' }),
        });
        return;
      }

      const fileRes = await fetch(`${FILE_API}/${fileInfo.result.file_path}`);
      if (!fileRes.ok) throw new Error('File fetch failed');
      const content = await fileRes.text();

      const totalQuestions = countQuestions(content);
      const converted = convertFormat(content);
      const convertedQuestions = countQuestions(converted);

      // Send as document
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const fileBytes = Buffer.from(converted, 'utf-8');
      const parts = [];
      const append = (str) => parts.push(Buffer.from(str, 'utf-8'));
      const outputFilename = fileName.replace(/\.txt$/i, '') + '_CONVERTED.txt';
      const caption = `✅ <b>Format Conversion Complete!</b>\n\n📄 <b>Original file:</b> <code>${fileName}</code>\n📊 <b>Questions before:</b> ${totalQuestions}\n📊 <b>Questions after:</b> ${convertedQuestions}\n📦 <b>Output size:</b> ${(fileBytes.length / 1024).toFixed(1)} KB\n\n⚡ <i>Pure regex — No AI used!</i>`;

      append(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`);
      append(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`);
      append(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`);
      append(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${outputFilename}"\r\nContent-Type: text/plain\r\n\r\n`);
      parts.push(fileBytes);
      append(`\r\n--${boundary}--\r\n`);

      await fetch(`${BOT_URL}/sendDocument`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: Buffer.concat(parts),
      });

      await fetch(`${BOT_URL}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: processingMsgId }),
      }).catch(() => {});

    } catch (err) {
      await fetch(`${BOT_URL}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: processingMsgId, text: `❌ <b>Error:</b> ${err.message}\n\nDobara try karo.`, parse_mode: 'HTML' }),
      });
    }

  } else {
    // Auto Blank Line Remover mode
    const processingRes = await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⏳ <b>Processing File...</b>\n\n📄 <b>File:</b> <code>${fileName}</code>\n📦 <b>Size:</b> ${(fileSize / 1024).toFixed(1)} KB\n\n🔄 <i>Blank lines remove ho rahi hain...</i>`,
        parse_mode: 'HTML',
      }),
    });
    const processingMsg = await processingRes.json();
    const processingMsgId = processingMsg?.result?.message_id;

    try {
      const fileInfoRes = await fetch(`${BOT_URL}/getFile?file_id=${document.file_id}`);
      const fileInfo = await fileInfoRes.json();

      if (!fileInfo.ok) {
        await fetch(`${BOT_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: processingMsgId, text: `❌ <b>Download failed!</b>`, parse_mode: 'HTML' }),
        });
        return;
      }

      const fileRes = await fetch(`${FILE_API}/${fileInfo.result.file_path}`);
      if (!fileRes.ok) throw new Error('File fetch failed');
      const content = await fileRes.text();

      const originalCount = countQuestions(content);
      const { fixedContent, removedCount, totalLines, finalLines } = fixQuestionsFile(content);

      if (removedCount === 0) {
        await fetch(`${BOT_URL}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: processingMsgId, text: `✅ <b>File already clean!</b>\n\n📄 <b>File:</b> <code>${fileName}</code>\n📊 <b>Questions:</b> ${originalCount}\n📝 <b>Lines:</b> ${totalLines}\n\n<i>Koi extra blank lines nahi mili — file already perfect hai! ✨</i>`, parse_mode: 'HTML' }),
        });
        return;
      }

      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const fileBytes = Buffer.from(fixedContent, 'utf-8');
      const parts = [];
      const append = (str) => parts.push(Buffer.from(str, 'utf-8'));
      const outputFilename = fileName.replace(/\.txt$/i, '') + '_FIXED.txt';
      const caption = `✅ <b>Blank Line Removal Complete!</b>\n\n📄 <b>Original:</b> <code>${fileName}</code>\n📊 <b>Questions:</b> ${originalCount}\n📝 <b>Lines before:</b> ${totalLines}\n📝 <b>Lines after:</b> ${finalLines}\n🗑️ <b>Blank lines removed:</b> ${removedCount}`;

      append(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`);
      append(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`);
      append(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`);
      append(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${outputFilename}"\r\nContent-Type: text/plain\r\n\r\n`);
      parts.push(fileBytes);
      append(`\r\n--${boundary}--\r\n`);

      await fetch(`${BOT_URL}/sendDocument`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: Buffer.concat(parts),
      });

      await fetch(`${BOT_URL}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: processingMsgId }),
      }).catch(() => {});

    } catch (err) {
      await fetch(`${BOT_URL}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: processingMsgId, text: `❌ <b>Error:</b> ${err.message}`, parse_mode: 'HTML' }),
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  PDF HANDLERS (from upsc-pdf-bot — all original logic unchanged)
// ═══════════════════════════════════════════════════════════════════════

async function handleDocument(chatId, msgId, file) {
  const session = sessions.get(chatId);
  if (!session || !session.mode) {
    await sendMessage(chatId,
`⚠️ Pehle ek converter mode choose karo — /start ya /menu bhejo.`,
      { reply_markup: mainKeyboard() }
    );
    return;
  }

  const buffer = await downloadFile(file.file_id);

  if (session.mode === 'sfg') {
    await handleSfgFile(chatId, msgId, buffer, file.file_name);
  } else if (session.mode === 'vajiram') {
    await handleVajiramFile(chatId, msgId, buffer, file.file_name);
  } else if (session.mode === 'vision') {
    await handleVisionFile(chatId, msgId, buffer, file.file_name);
  }
}

async function handleSfgFile(chatId, msgId, buffer, filename) {
  const statusMsg = await sendMessage(chatId,
`⚡ <b>Processing ForumIAS SFG PDF…</b>

📄 File: <code>${filename}</code>
🔄 Extracting text…`,
    { reply_markup: backKeyboard() }
  );
  const statusMsgId = statusMsg.message_id;

  try {
    await sendChatAction(chatId, 'typing');
    const result = await processSfg(buffer, (progress) => {
      editMessageText(chatId, statusMsgId,
`⚡ <b>Processing ForumIAS SFG PDF…</b>

📄 File: <code>${filename}</code>
🔄 Progress: ${progress}%`,
        { reply_markup: backKeyboard() }
      ).catch(() => {});
    });

    if (!result.success) {
      await editMessageText(chatId, statusMsgId,
`❌ <b>Error processing PDF:</b>\n\n<code>${result.error}</code>\n\nPlease try again.`,
        { reply_markup: backKeyboard() }
      );
      return;
    }

    const outputBuffer = Buffer.from(result.output, 'utf-8');
    const outputFilename = (filename || 'SFG').replace(/\.pdf$/i, '') + '_CONVERTED.txt';

    await editMessageText(chatId, statusMsgId,
`✅ <b>ForumIAS SFG conversion complete!</b>

📊 Questions extracted: <b>${result.questionCount}</b>
📄 Lines: <b>${result.lineCount}</b>
📦 Size: <b>${(outputBuffer.length / 1024).toFixed(1)} KB</b>
${result.questionCount < 50 ? '\n⚠️ <i>Expected 50 questions — got ' + result.questionCount + '.</i>' : '\n✅ All 50 questions extracted!'}`,
      { reply_markup: backKeyboard() }
    );

    await sendDocument(chatId, outputBuffer, outputFilename);
  } catch (err) {
    await editMessageText(chatId, statusMsgId,
`❌ <b>Unexpected error:</b>\n\n<code>${err.message}</code>`,
      { reply_markup: backKeyboard() }
    );
  }

  sessions.delete(chatId);
}

async function handleVajiramFile(chatId, msgId, buffer, filename) {
  const session = sessions.get(chatId);
  if (!session) return;

  const hasTest = session.files.test;
  const hasSol = session.files.sol;

  if (!hasTest) {
    session.files.test = buffer;
    session.files.testName = filename;
    await sendMessage(chatId,
`✅ <b>Test Booklet received!</b>

📄 <code>${filename}</code>
📏 Size: ${(buffer.length / 1024).toFixed(1)} KB

📄 Ab <b>Solutions PDF</b> bhejo.`
    );
    return;
  }

  if (!hasSol) {
    session.files.sol = buffer;
    session.files.solName = filename;

    const statusMsg = await sendMessage(chatId,
`⚙️ <b>Compiling Vajiram &amp; Ravi PDFs…</b>

📝 Test: <code>${session.files.testName}</code>
📄 Sol: <code>${filename}</code>
🔄 Processing…`,
      { reply_markup: backKeyboard() }
    );
    const statusMsgId = statusMsg.message_id;

    try {
      await sendChatAction(chatId, 'typing');
      const result = await processVajiram(
        session.files.test,
        session.files.sol,
        (progress, label) => {
          editMessageText(chatId, statusMsgId,
`⚙️ <b>Compiling Vajiram &amp; Ravi PDFs…</b>

📝 Test: <code>${session.files.testName}</code>
📄 Sol: <code>${filename}</code>
🔄 ${label} (${Math.round(progress)}%)`,
            { reply_markup: backKeyboard() }
          ).catch(() => {});
        }
      );

      if (!result.success) {
        await editMessageText(chatId, statusMsgId,
`❌ <b>Error processing PDFs:</b>\n\n<code>${result.error}</code>`,
          { reply_markup: backKeyboard() }
        );
        return;
      }

      const outputBuffer = Buffer.from(result.output, 'utf-8');
      const outputFilename = (session.files.testName || 'VAJIRAM').replace(/\.pdf$/i, '') + '_COMPILED.txt';

      await editMessageText(chatId, statusMsgId,
`✅ <b>Vajiram &amp; Ravi compilation complete!</b>

📊 Questions: <b>${result.questionCount}</b>
📄 Lines: <b>${result.lineCount}</b>
📦 Size: <b>${(outputBuffer.length / 1024).toFixed(1)} KB</b>`,
        { reply_markup: backKeyboard() }
      );

      await sendDocument(chatId, outputBuffer, outputFilename);
    } catch (err) {
      await editMessageText(chatId, statusMsgId,
`❌ <b>Unexpected error:</b>\n\n<code>${err.message}</code>`,
        { reply_markup: backKeyboard() }
      );
    }

    sessions.delete(chatId);
    return;
  }

  await sendMessage(chatId, `⚠️ Processing already complete. /menu send karo phir se shuru karne ke liye.`);
}

async function handleVisionFile(chatId, msgId, buffer, filename) {
  const session = sessions.get(chatId);
  if (!session) return;

  const hasTest = session.files.test;
  const hasSol = session.files.sol;

  if (!hasTest) {
    session.files.test = buffer;
    session.files.testName = filename;
    await sendMessage(chatId,
`✅ <b>Test PDF received!</b>

📄 <code>${filename}</code>
📏 Size: ${(buffer.length / 1024).toFixed(1)} KB

💡 Ab <b>Solution PDF</b> bhejo.`
    );
    return;
  }

  if (!hasSol) {
    session.files.sol = buffer;
    session.files.solName = filename;

    const statusMsg = await sendMessage(chatId,
`🔮 <b>Converting VisionIAS PDFs…</b>

📋 Test: <code>${session.files.testName}</code>
💡 Sol: <code>${filename}</code>
🔄 Processing…`,
      { reply_markup: backKeyboard() }
    );
    const statusMsgId = statusMsg.message_id;

    try {
      await sendChatAction(chatId, 'typing');
      const result = await processVision(
        session.files.test,
        session.files.sol,
        (progress, label) => {
          editMessageText(chatId, statusMsgId,
`🔮 <b>Converting VisionIAS PDFs…</b>

📋 Test: <code>${session.files.testName}</code>
💡 Sol: <code>${filename}</code>
🔄 ${label} (${Math.round(progress)}%)`,
            { reply_markup: backKeyboard() }
          ).catch(() => {});
        }
      );

      if (!result.success) {
        await editMessageText(chatId, statusMsgId,
`❌ <b>Error processing PDFs:</b>\n\n<code>${result.error}</code>`,
          { reply_markup: backKeyboard() }
        );
        return;
      }

      const outputBuffer = Buffer.from(result.output, 'utf-8');
      const outputFilename = (session.files.testName || 'VISIONIAS').replace(/\.pdf$/i, '') + '_CONVERTED.txt';

      await editMessageText(chatId, statusMsgId,
`✅ <b>VisionIAS conversion complete!</b>

📊 Questions: <b>${result.questionCount}</b>
📄 Lines: <b>${result.lineCount}</b>
📦 Size: <b>${(outputBuffer.length / 1024).toFixed(1)} KB</b>`,
        { reply_markup: backKeyboard() }
      );

      await sendDocument(chatId, outputBuffer, outputFilename);
    } catch (err) {
      await editMessageText(chatId, statusMsgId,
`❌ <b>Unexpected error:</b>\n\n<code>${err.message}</code>`,
        { reply_markup: backKeyboard() }
      );
    }

    sessions.delete(chatId);
    return;
  }

  await sendMessage(chatId, `⚠️ Processing already complete. /menu send karo phir se shuru karne ke liye.`);
}

// ═══════════════════════════════════════════════════════════════════════
//  TEXT COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════
async function handleTextMessage(chatId, msgId, text, firstName) {
  const cmd = text.trim();

  if (cmd === '/start' || cmd.startsWith('/start ')) {
    sessions.delete(chatId);
    delete userState[chatId];
    await handleStart(chatId, firstName);
    return;
  }
  if (cmd === '/menu') {
    await handleMenu(chatId);
    return;
  }
  if (cmd === '/help') {
    await handleHelp(chatId);
    return;
  }
  if (cmd === '/about') {
    await handleAbout(chatId);
    return;
  }
  if (cmd === '/txt') {
    userState[chatId] = 'waiting_for_txt_file';
    await sendMessage(chatId, TXT_PROMPT_TEXT,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'menu' }]] } }
    );
    return;
  }

  // If we're in a TXT session and user sends text instead of file
  if (userState[chatId] === 'waiting_for_txt_file') {
    await sendMessage(chatId,
`📎 <b>File chahiye!</b>\n\n<code>.txt</code> file bhejo jise convert karna hai.\n\n<i>Cancel karne ke liye /start dabao.</i>`,
      { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'menu' }]] } }
    );
    return;
  }

  // If we're in a PDF session and user sends text instead of file
  const session = sessions.get(chatId);
  if (session) {
    await sendMessage(chatId,
`📄 Please <b>PDF file as document</b> bhejo.\n\nMode change karna ho toh /menu bhejo.`,
      { reply_markup: backKeyboard() }
    );
    return;
  }

  await sendMessage(chatId,
`Unknown command. /start se shuru karo ya /help se instructions dekho.`
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN WEBHOOK ROUTER
// ═══════════════════════════════════════════════════════════════════════
async function handleWebhook(update) {
  const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
  if (!chatId) return;

  const msgId = update.message?.message_id ?? update.callback_query?.message?.message_id;
  const firstName = update.message?.from?.first_name ?? update.callback_query?.from?.first_name ?? 'User';

  // Callback query (inline button presses)
  if (update.callback_query) {
    await handleCallback(
      chatId,
      msgId,
      update.callback_query.data,
      update.callback_query.id,
      firstName
    );
    return;
  }

  // Document message
  if (update.message?.document) {
    const doc = update.message.document;

    // ── TXT file ──
    const isTxt = doc.file_name && doc.file_name.toLowerCase().endsWith('.txt');
    const isFormatConvertMode = userState[chatId] === 'waiting_for_txt_file';

    if (isTxt || isFormatConvertMode) {
      await handleTxtFile(chatId, doc, isFormatConvertMode);
      return;
    }

    // ── PDF file ──
    if (!doc.mime_type || !doc.mime_type.includes('pdf')) {
      await sendMessage(chatId,
`⚠️ <b>PDF ya .txt file bhejo.</b>\n\nAgar .txt fix karna hai — seedha file bhejo.\nAgar PDF convert karna hai — pehle /menu se mode choose karo.`
      );
      return;
    }
    if (doc.file_size > 50 * 1024 * 1024) {
      await sendMessage(chatId, `⚠️ File too large. Maximum size: <b>50 MB</b>.`);
      return;
    }
    await handleDocument(chatId, msgId, doc);
    return;
  }

  // Photo — helpful error
  if (update.message?.photo) {
    await sendMessage(chatId,
`📸 Images process nahi ho sakti. PDF ko <b>Document</b> ke roop mein bhejo (Gallery nahi!).\n\nTelegram mein 📎 icon dabao aur <b>File</b> select karo.`
    );
    return;
  }

  // Text message
  if (update.message?.text) {
    await handleTextMessage(chatId, msgId, update.message.text, firstName);
    return;
  }
}

module.exports = { handleWebhook, handleStart, sessions };
