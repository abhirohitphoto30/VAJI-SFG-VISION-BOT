/**
 * Unified bot handler — VAJI + SFG + VISION BOT
 *
 * Merged from:
 *   1. abhirohitphoto30/upsc-pdf-bot  → PDF converters (SFG, Vajiram, VisionIAS)
 *   2. abhirohitphoto30/txtbot        → TXT File Fixer (blank-line remover + format converter)
 *
 * All original processing functions are UNCHANGED.
 * Only the routing layer is new.
 */

'use strict';

// ── PDF Bot imports (upsc-pdf-bot originals) ─────────────────────────
const { sendMessage, sendDocument, sendChatAction, editMessageText, answerCallbackQuery } = require('./api');
const { processSfg }     = require('./sfg');
const { processVajiram } = require('./vajiram');
const { processVision }  = require('./vision');

// ── TXT Bot imports (txtbot originals) ───────────────────────────────
const { fixQuestionsFile, countQuestions, convertFormat } = require('./txtfixer');

// ─────────────────────────────────────────────────────────────────────
//  SHARED STATE
// ─────────────────────────────────────────────────────────────────────

/** PDF converter sessions (upsc-pdf-bot) */
const sessions = new Map();

/** TXT bot user state (txtbot) */
const userState = {};

// ─────────────────────────────────────────────────────────────────────
//  TXT BOT HELPERS  (ported exactly from txtbot/api/telegram.js)
//  Using BOT_TOKEN env var (standardised from TELEGRAM_BOT_TOKEN)
// ─────────────────────────────────────────────────────────────────────

function getTxtAPI() {
  const token = process.env.BOT_TOKEN;
  return {
    API:      `https://api.telegram.org/bot${token}`,
    FILE_API: `https://api.telegram.org/file/bot${token}`,
  };
}

/** callTelegram — exactly like txtbot's version */
async function callTelegram(method, body) {
  const { API } = getTxtAPI();
  const res = await fetch(`${API}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return res.json();
}

/** sendTxtMessage — returns full response {ok, result} like original txtbot */
async function sendTxtMessage(chatId, text, extra = {}) {
  return callTelegram('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

/** editTxtMessage — exactly like original txtbot editMessage */
async function editTxtMessage(chatId, messageId, text, extra = {}) {
  return callTelegram('editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra,
  });
}

/** sendTxtDocument — manual multipart, exactly like txtbot's sendDocument */
async function sendTxtDocument(chatId, filename, content, caption) {
  const { API } = getTxtAPI();
  const boundary  = '----FormBoundary' + Math.random().toString(36).slice(2);
  const fileBytes = Buffer.from(content, 'utf-8');
  const parts = [];
  const append = (str) => parts.push(Buffer.from(str, 'utf-8'));

  append(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`);
  append(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`);
  append(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`);
  append(`--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n`);
  parts.push(fileBytes);
  append(`\r\n--${boundary}--\r\n`);

  await fetch(`${API}/sendDocument`, {
    method:  'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body:    Buffer.concat(parts),
  });
}

function makeKeyboard(rows) {
  return { reply_markup: JSON.stringify({ inline_keyboard: rows }) };
}

// ─────────────────────────────────────────────────────────────────────
//  PDF BOT HELPERS  (upsc-pdf-bot originals)
// ─────────────────────────────────────────────────────────────────────

function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '⚡ ForumIAS SFG (50 Q)',    callback_data: 'mode:sfg' }],
      [{ text: '⚙️ Vajiram & Ravi (100 Q)', callback_data: 'mode:vajiram' }],
      [{ text: '🔮 VisionIAS (100 Q)',       callback_data: 'mode:vision' }],
      [{ text: '📝 TXT File Fixer',          callback_data: 'show_txt_info' }],
    ],
  };
}

function backKeyboard() {
  return {
    inline_keyboard: [[{ text: '↩️ Back to Menu', callback_data: 'menu' }]],
  };
}

// ─────────────────────────────────────────────────────────────────────
//  DOWNLOAD FILE  (unchanged from upsc-pdf-bot)
// ─────────────────────────────────────────────────────────────────────

async function downloadFile(fileId) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const fileInfo  = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
  ).then(r => r.json());
  if (!fileInfo.ok) throw new Error(`getFile failed: ${fileInfo.description}`);
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.result.file_path}`;
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// ─────────────────────────────────────────────────────────────────────
//  /start  — combined welcome
// ─────────────────────────────────────────────────────────────────────

async function handleStart(chatId, firstName) {
  const name = firstName || 'User';
  await sendMessage(chatId,
`╔══════════════════════════════════╗
  🤖 <b>VAJI + SFG + VISION BOT</b>
╚══════════════════════════════════╝

Namaste <b>${name}</b>! 👋 Swagat hai!

Yeh bot do kaam karta hai:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 <b>MODULE 1 — UPSC PDF → TXT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>ForumIAS SFG</b> — 50 Q (Solutions PDF bhejo)
⚙️ <b>Vajiram &amp; Ravi</b> — 100 Q (Test + Solutions PDF)
🔮 <b>VisionIAS</b> — 100 Q (Test + Solutions PDF)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>MODULE 2 — TXT File Fixer</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Sirf <b>.txt file bhejo</b> → Auto blank-line fix
• /txt command → Format converter (Wrong→Correct)

<b>Neeche se choose karo 👇</b>`,
    { reply_markup: mainKeyboard() }
  );
}

// ─────────────────────────────────────────────────────────────────────
//  /help  — all commands with examples
// ─────────────────────────────────────────────────────────────────────

async function handleHelp(chatId) {
  await sendMessage(chatId,
`📖 <b>VAJI + SFG + VISION BOT — Complete Help</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⌨️ <b>ALL COMMANDS:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/start — Welcome screen + mode chooser
/help  — Yeh complete guide
/menu  — PDF converter menu par wapas jao
/txt   — TXT Format Converter mode ON karo
/about — Bot ki info

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 <b>PDF CONVERTER — KAISE USE KAREIN:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>⚡ ForumIAS SFG</b>
  1. /start → "ForumIAS SFG" button dabao
  2. Solutions PDF bhejo
  3. .txt file milegi ✅

<b>⚙️ Vajiram &amp; Ravi</b>
  1. /start → "Vajiram &amp; Ravi" button dabao
  2. Test Booklet PDF bhejo
  3. Solutions PDF bhejo
  4. .txt file milegi ✅

<b>🔮 VisionIAS</b>
  1. /start → "VisionIAS" button dabao
  2. Test PDF bhejo
  3. Solution PDF bhejo
  4. .txt file milegi ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>TXT FIXER — KAISE USE KAREIN:</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>🔹 Auto Blank Line Remover:</b>
  Seedha .txt file bhejo — bot fix kar dega!

<b>🔹 Format Converter:</b>
  /txt → phir .txt file bhejo

<b>WRONG format (inline):</b>
<code>Q.1) Consider: 1️⃣ Point A 2️⃣ Point B How many?
Option A
Option B ✅</code>

<b>CORRECT format (after /txt):</b>
<code>Q.1) Consider:
1️⃣ Point A
2️⃣ Point B
How many?
😂
Option A
Option B ✅</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 PDF → Document ke roop mein bhejo (Gallery nahi!)
💡 TXT max size: 20 MB | PDF max size: 50 MB`,
    makeKeyboard([[{ text: '🏠 Main Menu', callback_data: 'show_start' }]])
  );
}

// ─────────────────────────────────────────────────────────────────────
//  /about
// ─────────────────────────────────────────────────────────────────────

async function handleAbout(chatId) {
  await sendMessage(chatId,
`╔══════════════════════════════════╗
  ℹ️ <b>About VAJI + SFG + VISION BOT</b>
╚══════════════════════════════════╝

🤖 <b>Name:</b> VAJI + SFG + VISION BOT
🏷️ <b>Version:</b> 1.0 — Merged Edition
☁️ <b>Platform:</b> Vercel Serverless / Polling
⚡ <b>Engine:</b> Pure Regex + PDF.js (No AI!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>PDF Converter (upsc-pdf-bot):</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔️ ForumIAS SFG — 50 Questions
✔️ Vajiram &amp; Ravi — 100 Questions
✔️ VisionIAS — 100 Questions
✔️ Auto correct answer ✅ marking
✔️ Explanation extraction (Ex:)
✔️ 50 MB PDF support

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>TXT Fixer (txtbot):</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔️ Blank line removal (auto)
✔️ Format conversion (No AI!)
✔️ 1️⃣2️⃣3️⃣ emoji points expansion
✔️ 😂 separator auto-add
✔️ 20 MB TXT support

🔒 Files permanently store nahi hoti.

<i>Made with ❤️ for UPSC aspirants</i>`,
    makeKeyboard([[
      { text: '📖 Help', callback_data: 'show_help' },
      { text: '🏠 Menu', callback_data: 'show_start' },
    ]])
  );
}

// ─────────────────────────────────────────────────────────────────────
//  TXT BOT CONSTANTS  (ported exactly from txtbot)
// ─────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────
//  TXT FILE HANDLER  (ported exactly from txtbot/api/telegram.js)
// ─────────────────────────────────────────────────────────────────────

async function handleTxtDocument(chatId, document) {
  const { API, FILE_API } = getTxtAPI();
  const fileName = document.file_name ?? 'file.txt';
  const fileSize = document.file_size ?? 0;

  // Size check
  if (fileSize > 20 * 1024 * 1024) {
    await sendTxtMessage(chatId,
      `❌ <b>File too large!</b>\n\nMax size <b>20 MB</b> hai.\n\nApni file split karke bhejo.`,
      makeKeyboard([[{ text: '🏠 Home', callback_data: 'show_start' }]])
    );
    return;
  }

  // ── /txt mode: Format Converter ──────────────────────────────────
  if (userState[chatId] === 'waiting_for_txt_file') {
    delete userState[chatId];

    const processingMsg = await sendTxtMessage(chatId,
      `⏳ <b>Converting Format...</b>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n📄 <b>File:</b> <code>${fileName}</code>\n📦 <b>Size:</b> ${(fileSize / 1024).toFixed(1)} KB\n━━━━━━━━━━━━━━━━━━━━━━━\n\n🔄 <i>Pure regex se format ho rahi hai...</i>\n⚡ <i>Koi AI nahi — 100% local logic!</i>`
    );
    const processingMsgId = processingMsg?.result?.message_id;

    try {
      const fileInfoRes = await fetch(`${API}/getFile?file_id=${document.file_id}`);
      const fileInfo    = await fileInfoRes.json();

      if (!fileInfo.ok) {
        await editTxtMessage(chatId, processingMsgId,
          `❌ <b>Download failed!</b>\n\nFile download nahi ho saki.\nDobara try karo ya /help dekho.`
        );
        return;
      }

      const fileRes = await fetch(`${FILE_API}/${fileInfo.result.file_path}`);
      if (!fileRes.ok) throw new Error('File fetch failed');
      const content = await fileRes.text();

      const totalQuestions    = countQuestions(content);
      const convertedContent  = convertFormat(content);
      const questionsAfter    = countQuestions(convertedContent);
      const outName           = fileName.replace(/\.txt$/i, '') + '_formatted.txt';

      if (processingMsgId) {
        await editTxtMessage(chatId, processingMsgId,
          `✅ <b>Conversion Complete!</b>\n\n📄 <code>${fileName}</code>\n\n<i>📤 Formatted file bhej raha hoon...</i>`
        );
      }

      const caption =
        `✅ <b>Format Conversion Complete!</b>\n\n` +
        `⚡ <b>Pure regex — No AI!</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>Report:</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `├ ❓ Questions found: <b>${totalQuestions}</b>\n` +
        `├ 📝 Points expanded: <b>✅</b>\n` +
        `└ 😂 Separators added: <b>✅</b>\n\n` +
        `📁 <b>${outName}</b>`;

      await sendTxtDocument(chatId, outName, convertedContent, caption);

      await sendTxtMessage(chatId,
        `🎉 <b>Done! File Ready!</b>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ <b>${questionsAfter}</b> questions format ho gaye!\n━━━━━━━━━━━━━━━━━━━━━━━\n\nAb file CORRECT format mein hai. 📚\n\n<i>Aur files ke liye /txt dobara use karo 😊</i>`,
        makeKeyboard([[
          { text: '🔄 Aur Convert karo', callback_data: 'show_txt' },
          { text: '🏠 Home',             callback_data: 'show_start' },
        ]])
      );
    } catch (err) {
      await editTxtMessage(chatId, processingMsgId,
        `❌ <b>Error aaya!</b>\n\nFile process karne mein kuch gadbad ho gayi.\n\nDobara try karo ya /help dekho.`
      ).catch(() => sendTxtMessage(chatId, '❌ File process nahi ho saki. Dobara try karo.'));
    }
    return;
  }

  // ── Normal mode: Blank Line Remover ──────────────────────────────
  const processingMsg = await sendTxtMessage(chatId,
    `⏳ <b>Processing...</b>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n📄 <b>File:</b> <code>${fileName}</code>\n📦 <b>Size:</b> ${(fileSize / 1024).toFixed(1)} KB\n━━━━━━━━━━━━━━━━━━━━━━━\n\n🔍 <i>Blank lines dhundh raha hoon...</i>\n🔧 <i>Fix kar raha hoon...</i>`
  );
  const processingMsgId = processingMsg?.result?.message_id;

  try {
    const fileInfoRes = await fetch(`${API}/getFile?file_id=${document.file_id}`);
    const fileInfo    = await fileInfoRes.json();

    if (!fileInfo.ok) {
      await editTxtMessage(chatId, processingMsgId,
        `❌ <b>Download failed!</b>\n\nFile download nahi ho saki.\nDobara try karo ya /help dekho.`
      );
      return;
    }

    const fileRes = await fetch(`${FILE_API}/${fileInfo.result.file_path}`);
    if (!fileRes.ok) throw new Error('File fetch failed');
    const content = await fileRes.text();

    const { fixedContent, removedCount, totalLines, finalLines } = fixQuestionsFile(content);
    const questionsAfter = countQuestions(fixedContent);
    const outName        = fileName.replace(/\.txt$/i, '') + '_fixed.txt';
    const savedPercent   = totalLines > 0 ? ((removedCount / totalLines) * 100).toFixed(1) : '0';

    if (processingMsgId) {
      await editTxtMessage(chatId, processingMsgId,
        `✅ <b>Processing Complete!</b>\n\n📄 <code>${fileName}</code>\n\n<i>📤 Fixed file bhej raha hoon...</i>`
      );
    }

    const caption = removedCount > 0
      ? `✅ <b>File Fixed Successfully!</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>Statistics:</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `├ 🗑 Blank lines removed: <b>${removedCount}</b>\n` +
        `├ 📝 Total lines: <b>${totalLines}</b> → <b>${finalLines}</b>\n` +
        `├ 📉 Size reduced: <b>${savedPercent}%</b>\n` +
        `└ ❓ Questions found: <b>${questionsAfter}</b>\n\n` +
        `📁 <b>${outName}</b>`
      : `✅ <b>File Checked!</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `ℹ️ Koi extra blank lines nahi mili — file already clean hai!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 Total lines: <b>${totalLines}</b>\n` +
        `❓ Questions found: <b>${questionsAfter}</b>\n\n` +
        `📁 <b>${outName}</b>`;

    await sendTxtDocument(chatId, outName, fixedContent, caption);

    if (removedCount > 0) {
      await sendTxtMessage(chatId,
        `🎉 <b>File Clean Ho Gayi!</b>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n🗑 <b>${removedCount}</b> extra blank lines hata di\n📚 <b>${questionsAfter}</b> questions ready\n━━━━━━━━━━━━━━━━━━━━━━━\n\n<i>Aur files fix karne ke liye bhejte raho 😊</i>`,
        makeKeyboard([[
          { text: '🔄 Format Convert', callback_data: 'show_txt' },
          { text: '🏠 Home',           callback_data: 'show_start' },
        ]])
      );
    } else {
      await sendTxtMessage(chatId,
        `✅ <b>File Already Clean Thi!</b>\n\nKoi blank lines nahi mili. File already perfect format mein hai. 👍`,
        makeKeyboard([[
          { text: '🔄 Format Convert', callback_data: 'show_txt' },
          { text: '🏠 Home',           callback_data: 'show_start' },
        ]])
      );
    }
  } catch (err) {
    await editTxtMessage(chatId, processingMsgId,
      `❌ <b>Error aaya!</b>\n\nFile process karne mein kuch gadbad ho gayi.\n\nDobara try karo ya /help dekho.`
    ).catch(() => sendTxtMessage(chatId, '❌ File process nahi ho saki. Dobara try karo.'));
  }
}

// ─────────────────────────────────────────────────────────────────────
//  PDF HANDLERS  (copied EXACTLY from upsc-pdf-bot/lib/bot.js)
// ─────────────────────────────────────────────────────────────────────

async function handleDocument(chatId, msgId, file) {
  const session = sessions.get(chatId);
  if (!session || !session.mode) {
    await sendMessage(chatId,
      `⚠️ Please select a converter mode first by sending /start or /menu.`,
      { reply_markup: mainKeyboard() }
    );
    return;
  }

  const buffer = await downloadFile(file.file_id);

  if (session.mode === 'sfg')     await handleSfgFile(chatId, msgId, buffer, file.file_name);
  else if (session.mode === 'vajiram') await handleVajiramFile(chatId, msgId, buffer, file.file_name);
  else if (session.mode === 'vision')  await handleVisionFile(chatId, msgId, buffer, file.file_name);
}

// ── SFG (unchanged from upsc-pdf-bot) ────────────────────────────────
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
        `❌ <b>Error processing PDF:</b>\n\n<code>${result.error}</code>\n\nPlease try again or send a different PDF.`,
        { reply_markup: backKeyboard() }
      );
      return;
    }

    const outputBuffer   = Buffer.from(result.output, 'utf-8');
    const outputFilename = (filename || 'SFG').replace(/\.pdf$/i, '') + '_CONVERTED.txt';

    const sfgSt = result.stats || {};
    const sfgCaption = `✅ <b>ForumIAS SFG — Done!</b>\n\n` +
      `📊 <b>Questions:</b> <b>${result.questionCount}/50</b>\n\n` +
      `🔍 <b>Answers:</b>\n✅ Matched: <b>${sfgSt.matched ?? '?'}</b>  |  ❌ Missing: <b>${sfgSt.noAns ?? '?'}</b>\n\n` +
      `📝 <b>Explanations:</b>\n✅ Found: <b>${sfgSt.explanationsFound ?? '?'}</b>  |  ⚠️ Missing: <b>${sfgSt.noExpl ?? '?'}</b>\n\n` +
      `📄 Lines: <b>${result.lineCount}</b>  |  📦 <b>${(outputBuffer.length / 1024).toFixed(1)} KB</b>` +
      (result.questionCount < 50 ? `\n⚠️ Expected 50 questions — got ${result.questionCount}.` : '');
    await editMessageText(chatId, statusMsgId,
      `✅ <b>Done! File ready — stats in caption 👇</b>`,
      { reply_markup: backKeyboard() }
    ).catch(() => {});
    await sendDocument(chatId, outputBuffer, outputFilename, sfgCaption);
  } catch (err) {
    console.error('SFG error:', err);
    await editMessageText(chatId, statusMsgId,
      `❌ <b>Unexpected error:</b>\n\n<code>${err.message}</code>\n\nPlease try again.`,
      { reply_markup: backKeyboard() }
    ).catch(() => {});
  }

  sessions.delete(chatId);
}

// ── Vajiram (unchanged from upsc-pdf-bot) ────────────────────────────
async function handleVajiramFile(chatId, msgId, buffer, filename) {
  const session = sessions.get(chatId);
  if (!session) return;

  const hasTest = session.files.test;
  const hasSol  = session.files.sol;

  if (!hasTest) {
    session.files.test     = buffer;
    session.files.testName = filename;

    await sendMessage(chatId,
`✅ <b>Test Booklet received!</b>

📄 <code>${filename}</code>
📏 Size: ${(buffer.length / 1024).toFixed(1)} KB

📄 Now please send the <b>Solutions PDF</b> to complete the conversion.`
    );
    return;
  }

  if (!hasSol) {
    session.files.sol     = buffer;
    session.files.solName = filename;

    const statusMsg = await sendMessage(chatId,
`⚙️ <b>Compiling Vajiram & Ravi PDFs…</b>

📝 Test: <code>${session.files.testName}</code>
📄 Sol:  <code>${filename}</code>
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
`⚙️ <b>Compiling Vajiram & Ravi PDFs…</b>

📝 Test: <code>${session.files.testName}</code>
📄 Sol:  <code>${filename}</code>
🔄 ${label} (${Math.round(progress)}%)`,
            { reply_markup: backKeyboard() }
          ).catch(() => {});
        }
      );

      if (!result.success) {
        await editMessageText(chatId, statusMsgId,
          `❌ <b>Error processing PDFs:</b>\n\n<code>${result.error}</code>\n\nPlease try again with valid Vajiram PDFs.`,
          { reply_markup: backKeyboard() }
        );
        return;
      }

      const outputBuffer   = Buffer.from(result.output, 'utf-8');
      const outputFilename = (session.files.testName || 'VAJIRAM').replace(/\.pdf$/i, '') + '_COMPILED.txt';

      const vajSt = result.stats || {};
      const vajCaption = `✅ <b>Vajiram & Ravi — Done!</b>\n\n` +
        `📊 <b>Questions:</b> <b>${result.questionCount}/100</b>\n\n` +
        `🔍 <b>Answers:</b>\n✅ Matched: <b>${vajSt.matched ?? '?'}</b>  |  ❌ Missing: <b>${vajSt.noAns ?? '?'}</b>\n\n` +
        `📝 <b>Explanations:</b>\n✅ Found: <b>${vajSt.explanationsFound ?? '?'}</b>  |  ⚠️ Missing: <b>${vajSt.noExpl ?? '?'}</b>\n\n` +
        `📄 Lines: <b>${result.lineCount}</b>  |  📦 <b>${(outputBuffer.length / 1024).toFixed(1)} KB</b>`;
      await editMessageText(chatId, statusMsgId,
        `✅ <b>Done! File ready — stats in caption 👇</b>`,
        { reply_markup: backKeyboard() }
      ).catch(() => {});
      await sendDocument(chatId, outputBuffer, outputFilename, vajCaption);
    } catch (err) {
      console.error('Vajiram error:', err);
      await editMessageText(chatId, statusMsgId,
        `❌ <b>Unexpected error:</b>\n\n<code>${err.message}</code>\n\nPlease try again.`,
        { reply_markup: backKeyboard() }
      ).catch(() => {});
    }

    sessions.delete(chatId);
    return;
  }

  await sendMessage(chatId, `⚠️ Processing already complete. Send /menu to start again.`);
}

// ── VisionIAS (unchanged from upsc-pdf-bot) ──────────────────────────
async function handleVisionFile(chatId, msgId, buffer, filename) {
  const session = sessions.get(chatId);
  if (!session) return;

  const hasTest = session.files.test;
  const hasSol  = session.files.sol;

  if (!hasTest) {
    session.files.test     = buffer;
    session.files.testName = filename;

    await sendMessage(chatId,
`✅ <b>Test PDF received!</b>

📄 <code>${filename}</code>
📏 Size: ${(buffer.length / 1024).toFixed(1)} KB

💡 Now please send the <b>Solution PDF</b> to complete the conversion.`
    );
    return;
  }

  if (!hasSol) {
    session.files.sol     = buffer;
    session.files.solName = filename;

    const statusMsg = await sendMessage(chatId,
`🔮 <b>Converting VisionIAS PDFs…</b>

📋 Test: <code>${session.files.testName}</code>
💡 Sol:  <code>${filename}</code>
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
💡 Sol:  <code>${filename}</code>
🔄 ${label} (${Math.round(progress)}%)`,
            { reply_markup: backKeyboard() }
          ).catch(() => {});
        }
      );

      if (!result.success) {
        await editMessageText(chatId, statusMsgId,
          `❌ <b>Error processing PDFs:</b>\n\n<code>${result.error}</code>\n\nPlease try again with valid VisionIAS PDFs.`,
          { reply_markup: backKeyboard() }
        );
        return;
      }

      const outputBuffer   = Buffer.from(result.output, 'utf-8');
      const outputFilename = (session.files.testName || 'VISIONIAS').replace(/\.pdf$/i, '') + '_CONVERTED.txt';

      const visSt = result.stats || {};
      const visCaption = `✅ <b>VisionIAS — Done!</b>\n\n` +
        `📊 <b>Questions:</b> <b>${result.questionCount}/100</b>\n\n` +
        `🔍 <b>Answers:</b>\n✅ Matched: <b>${visSt.matched ?? '?'}</b>  |  ❌ Missing: <b>${visSt.noAns ?? '?'}</b>\n\n` +
        `📝 <b>Explanations:</b>\n✅ Found: <b>${visSt.explanationsFound ?? '?'}</b>  |  ⚠️ Missing: <b>${visSt.noExpl ?? '?'}</b>\n\n` +
        `📄 Lines: <b>${result.lineCount}</b>  |  📦 <b>${(outputBuffer.length / 1024).toFixed(1)} KB</b>`;
      await editMessageText(chatId, statusMsgId,
        `✅ <b>Done! File ready — stats in caption 👇</b>`,
        { reply_markup: backKeyboard() }
      ).catch(() => {});
      await sendDocument(chatId, outputBuffer, outputFilename, visCaption);
    } catch (err) {
      console.error('Vision error:', err);
      await editMessageText(chatId, statusMsgId,
        `❌ <b>Unexpected error:</b>\n\n<code>${err.message}</code>\n\nPlease try again.`,
        { reply_markup: backKeyboard() }
      ).catch(() => {});
    }

    sessions.delete(chatId);
    return;
  }

  await sendMessage(chatId, `⚠️ Processing already complete. Send /menu to start again.`);
}

// ─────────────────────────────────────────────────────────────────────
//  CALLBACK HANDLER  (handles both txtbot & upsc-pdf-bot callbacks)
// ─────────────────────────────────────────────────────────────────────

async function handleCallback(chatId, msgId, data, callbackQueryId, firstName) {
  try {
    await answerCallbackQuery(callbackQueryId);
  } catch (_) {}

  // ── Shared: go to main menu / home ─────────────────────────────────
  if (data === 'menu' || data === 'show_start') {
    sessions.delete(chatId);
    delete userState[chatId];
    try {
      await editMessageText(chatId, msgId,
`🏠 <b>Main Menu — VAJI + SFG + VISION BOT</b>\n\nKya karna hai? 👇`,
        { reply_markup: mainKeyboard() }
      );
    } catch (_) {
      await sendMessage(chatId,
        `🏠 <b>Main Menu — VAJI + SFG + VISION BOT</b>\n\nKya karna hai? 👇`,
        { reply_markup: mainKeyboard() }
      );
    }
    return;
  }

  // ── txtbot: show help ───────────────────────────────────────────────
  if (data === 'show_help') {
    delete userState[chatId];
    await handleHelp(chatId);
    return;
  }

  // ── txtbot: show format converter ───────────────────────────────────
  if (data === 'show_txt') {
    userState[chatId] = 'waiting_for_txt_file';
    try {
      await editMessageText(chatId, msgId, TXT_PROMPT_TEXT,
        makeKeyboard([[{ text: '❌ Cancel', callback_data: 'show_start' }]])
      );
    } catch (_) {
      await sendTxtMessage(chatId, TXT_PROMPT_TEXT,
        makeKeyboard([[{ text: '❌ Cancel', callback_data: 'show_start' }]])
      );
    }
    return;
  }

  // ── txtbot info button ──────────────────────────────────────────────
  if (data === 'show_txt_info') {
    try {
      await editMessageText(chatId, msgId,
`📝 <b>TXT File Fixer</b>

<b>Kaise use karein:</b>
• Seedha <code>.txt</code> file bhejo → Auto blank-line fix
• /txt command → Format Converter mode

/txt dabao ya neeche button se start karo.`,
        makeKeyboard([[
          { text: '🔄 Format Converter', callback_data: 'show_txt' },
          { text: '↩️ Back',             callback_data: 'menu' },
        ]])
      );
    } catch (_) {}
    return;
  }

  // ── upsc-pdf-bot: mode selection ────────────────────────────────────
  const modeMatch = data.match(/^mode:(\w+)$/);
  if (modeMatch) {
    const mode = modeMatch[1];
    sessions.set(chatId, { mode, files: {} });
    delete userState[chatId];

    let modeText = '';
    if (mode === 'sfg') {
      modeText =
`⚡ <b>ForumIAS SFG Converter</b> (50 Questions)

📄 <b>Send your Solutions PDF now.</b>

The bot will extract all 50 questions with correct answers ✅ and explanations, then give you a formatted .txt file to download.

💡 <i>Single PDF upload — just send the solutions file.</i>`;
    } else if (mode === 'vajiram') {
      modeText =
`⚙️ <b>Vajiram & Ravi Converter</b> (100 Questions)

📝 <b>Step 1 of 2 —</b> Send the <b>Test Booklet PDF</b> (questions).
📄 <b>Step 2 of 2 —</b> Then send the <b>Solutions PDF</b> (answers + explanations).

You can send them in any order — the bot will auto-detect which is which based on content.

⏳ <i>Awaiting files…</i>`;
    } else if (mode === 'vision') {
      modeText =
`🔮 <b>VisionIAS Converter</b> (100 Questions)

📋 <b>Step 1 of 2 —</b> Send the <b>Test PDF</b> (question booklet).
💡 <b>Step 2 of 2 —</b> Send the <b>Solution PDF</b> (answers + explanations).

Send them one after the other — the bot will detect which is which.

⏳ <i>Awaiting files…</i>`;
    }

    try {
      await editMessageText(chatId, msgId, modeText, { reply_markup: backKeyboard() });
    } catch (_) {
      await sendMessage(chatId, modeText, { reply_markup: backKeyboard() });
    }
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────
//  TEXT COMMAND HANDLER
// ─────────────────────────────────────────────────────────────────────

async function handleTextMessage(chatId, text, firstName) {
  const cmd = text.trim();

  if (cmd === '/start' || cmd.startsWith('/start ')) {
    sessions.delete(chatId);
    delete userState[chatId];
    await handleStart(chatId, firstName);
    return;
  }
  if (cmd === '/menu') {
    sessions.delete(chatId);
    delete userState[chatId];
    await sendMessage(chatId,
      `🏠 <b>Main Menu</b>\n\nChoose a converter mode:`,
      { reply_markup: mainKeyboard() }
    );
    return;
  }
  if (cmd === '/help') {
    delete userState[chatId];
    await handleHelp(chatId);
    return;
  }
  if (cmd === '/about') {
    delete userState[chatId];
    await handleAbout(chatId);
    return;
  }
  if (cmd === '/txt') {
    userState[chatId] = 'waiting_for_txt_file';
    await sendTxtMessage(chatId, TXT_PROMPT_TEXT,
      makeKeyboard([[{ text: '❌ Cancel', callback_data: 'show_start' }]])
    );
    return;
  }

  // If waiting for TXT file and user sends text instead
  if (userState[chatId] === 'waiting_for_txt_file') {
    await sendTxtMessage(chatId,
      `📎 <b>File chahiye!</b>\n\n<code>.txt</code> file bhejo jise convert karna hai.\n\n<i>Cancel karne ke liye /start dabao.</i>`,
      makeKeyboard([[{ text: '❌ Cancel', callback_data: 'show_start' }]])
    );
    return;
  }

  // If in a PDF session
  if (sessions.get(chatId)) {
    await sendMessage(chatId,
      `📄 Please <b>send the PDF file</b> as a document attachment.\n\nIf you want to change mode, send /menu.`,
      { reply_markup: backKeyboard() }
    );
    return;
  }

  await sendMessage(chatId,
    `Unknown command. Send /start to begin, or /help for instructions.`
  );
}

// ─────────────────────────────────────────────────────────────────────
//  MAIN WEBHOOK ROUTER
// ─────────────────────────────────────────────────────────────────────

async function handleWebhook(update) {
  const chatId    = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
  if (!chatId) return;

  const msgId     = update.message?.message_id ?? update.callback_query?.message?.message_id;
  const firstName = update.message?.from?.first_name ?? update.callback_query?.from?.first_name ?? 'User';

  // ── Callback query (inline button presses) ──────────────────────────
  if (update.callback_query) {
    await handleCallback(chatId, msgId, update.callback_query.data, update.callback_query.id, firstName);
    return;
  }

  const message = update.message;
  if (!message) return;

  // ── Document ─────────────────────────────────────────────────────────
  if (message.document) {
    const doc      = message.document;
    const fileName = (doc.file_name || '').toLowerCase();

    // TXT file — always goes to TXT handler
    if (fileName.endsWith('.txt')) {
      await handleTxtDocument(chatId, doc);
      return;
    }

    // /txt mode — user sends any file while waiting → treat as TXT attempt
    if (userState[chatId] === 'waiting_for_txt_file') {
      await handleTxtDocument(chatId, doc);
      return;
    }

    // PDF file — goes to PDF converter
    if (!doc.mime_type || !doc.mime_type.includes('pdf')) {
      await sendMessage(chatId,
        `⚠️ <b>PDF ya .txt file bhejo.</b>\n\n• PDF convert karna → /start se mode choose karo\n• TXT fix karna → seedha .txt file bhejo`
      );
      return;
    }
    if (doc.file_size > 50 * 1024 * 1024) {
      await sendMessage(chatId, `⚠️ File too large. Maximum size is <b>50 MB</b>.`);
      return;
    }
    await handleDocument(chatId, msgId, doc);
    return;
  }

  // ── Photo ─────────────────────────────────────────────────────────────
  if (message.photo) {
    await sendMessage(chatId,
      `📸 Images process nahi ho sakti.\n\nPDF ko <b>Document</b> ke roop mein bhejo (Gallery nahi!).\n\nTelegram mein 📎 icon dabao → <b>File</b> select karo.`
    );
    return;
  }

  // ── Text / Commands ───────────────────────────────────────────────────
  if (message.text) {
    await handleTextMessage(chatId, message.text, firstName);
    return;
  }
}

module.exports = { handleWebhook, handleStart, sessions };
