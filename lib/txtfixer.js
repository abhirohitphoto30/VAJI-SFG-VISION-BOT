/**
 * TXT File Fixer — extracted from txtbot (abhirohitphoto30/txtbot)
 * All logic unchanged from original.
 * Features:
 *   - Blank line remover
 *   - Format converter (Pure Regex, No AI)
 *   - Emoji points expander
 */

const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

function fixQuestionsFile(content) {
  const lines = content.split("\n");
  const result = [];
  let removedCount = 0;
  let i = 0;

  while (i < lines.length) {
    const currentLine = lines[i];
    result.push(currentLine);

    if (currentLine.trimEnd().endsWith(":")) {
      let j = i + 1;
      let foundDigit = false;
      let nextNonBlankIdx = -1;

      while (j < lines.length) {
        if (lines[j].trim() !== "") {
          nextNonBlankIdx = j;
          if (/^\d+\./.test(lines[j].trimStart())) {
            foundDigit = true;
          }
          break;
        }
        j++;
      }

      if (foundDigit) {
        removedCount += nextNonBlankIdx - i - 1;
        i = nextNonBlankIdx - 1;
      }
    }
    i++;
  }

  return {
    fixedContent: result.join("\n"),
    removedCount,
    totalLines: lines.length,
    finalLines: result.length,
  };
}

function countQuestions(content) {
  const lines = content.split("\n");
  return lines.filter((l) => /^\s*\d+[\.\)]/.test(l) || /^\s*Q\.\d+\)/.test(l)).length;
}

function convertFormat(content) {
  const blockSplitRegex = /(?=^\s*[Qq]\.\d+\))/gm;
  const rawBlocks = content.split(blockSplitRegex).filter(b => b.trim());

  if (rawBlocks.length === 0) {
    return convertNumberedFormat(content);
  }

  const convertedBlocks = rawBlocks.map(block => convertSingleBlock(block));
  return convertedBlocks.join("\n\n");
}

function convertSingleBlock(block) {
  const lines = block.split("\n").map(l => l.trimEnd());
  const resultLines = [];
  let i = 0;
  let questionStemDone = false;
  let separatorAdded = false;

  while (i < lines.length) {
    const line = lines[i];

    if (i === 0 || (!questionStemDone && /^\s*[Qq]\.\d+\)/.test(line))) {
      const expanded = expandEmojiPoints(line);
      const expandedLines = expanded.lines;
      const hadPoints = expanded.hadPoints;

      for (const el of expandedLines) {
        resultLines.push(el);
      }

      if (hadPoints) {
        resultLines.push("😂");
        separatorAdded = true;
      }
      questionStemDone = true;
      i++;
      continue;
    }

    if (!separatorAdded && hasInlineEmojiPoints(line)) {
      const expanded = expandEmojiPoints(line);
      for (const el of expanded.lines) {
        resultLines.push(el);
      }
      if (expanded.hadPoints) {
        resultLines.push("😂");
        separatorAdded = true;
      }
      i++;
      continue;
    }

    if (line.trim() === "") {
      const nextNonBlank = lines.slice(i + 1).find(l => l.trim() !== "");
      if (!nextNonBlank || nextNonBlank.trim().startsWith("Ex:")) {
        resultLines.push("");
      }
      i++;
      continue;
    }

    if (line.trim() === "😂") {
      if (!separatorAdded) {
        resultLines.push("😂");
        separatorAdded = true;
      }
      i++;
      continue;
    }

    const isOption = isOptionLine(line);
    const isEx = /^\s*Ex[:.]/i.test(line);

    if ((isOption || isEx) && !separatorAdded) {
      resultLines.push("😂");
      separatorAdded = true;
    }

    resultLines.push(line);

    if (isEx) {
      resultLines.push("");
    }

    i++;
  }

  return resultLines.join("\n").trimEnd();
}

function hasInlineEmojiPoints(line) {
  return EMOJI_NUMBERS.some(e => line.includes(e));
}

function expandEmojiPoints(line) {
  const emojiPattern = EMOJI_NUMBERS.map(e => escapeRegex(e)).join("|");
  const splitter = new RegExp(`(${emojiPattern})`, "g");

  const parts = line.split(splitter).filter(p => p !== "");

  if (parts.length <= 1 || !EMOJI_NUMBERS.some(e => line.includes(e))) {
    return { lines: [line], hadPoints: false };
  }

  const resultLines = [];
  let i = 0;

  const prefix = parts[0].trim();
  if (prefix) {
    resultLines.push(prefix.replace(/\s+$/, ""));
  }
  i = 1;

  while (i < parts.length) {
    const emoji = parts[i];
    const isEmoji = EMOJI_NUMBERS.includes(emoji);
    if (isEmoji) {
      const text = (parts[i + 1] || "").trim();
      i += 2;
      resultLines.push(`${emoji} ${text}`);
    } else {
      const stem = parts[i].trim();
      if (stem) {
        resultLines.push(stem);
      }
      i++;
    }
  }

  return { lines: resultLines, hadPoints: true };
}

function isOptionLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^\s*[Qq]\.\d+\)/.test(t)) return false;
  if (/^\s*Ex[:.]/i.test(t)) return false;
  if (/^\s*\d+[\.\)]/.test(t)) return false;
  if (EMOJI_NUMBERS.some(e => t.startsWith(e))) return false;
  return true;
}

function convertNumberedFormat(content) {
  const lines = content.split("\n");
  const result = [];
  let i = 0;
  let insideQuestion = false;
  let separatorAdded = false;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (/^\s*\d+[\.\)]/.test(t) && !EMOJI_NUMBERS.some(e => t.startsWith(e))) {
      insideQuestion = true;
      separatorAdded = false;
      const expanded = expandEmojiPoints(line);
      for (const el of expanded.lines) result.push(el);
      if (expanded.hadPoints) {
        result.push("😂");
        separatorAdded = true;
      }
      i++;
      continue;
    }

    if (insideQuestion && hasInlineEmojiPoints(t) && !separatorAdded) {
      const expanded = expandEmojiPoints(line);
      for (const el of expanded.lines) result.push(el);
      if (expanded.hadPoints) {
        result.push("😂");
        separatorAdded = true;
      }
      i++;
      continue;
    }

    const isEx = /^\s*Ex[:.]/i.test(t);
    const isOpt = insideQuestion && isOptionLine(line) && !separatorAdded;

    if ((isOpt || isEx) && !separatorAdded) {
      result.push("😂");
      separatorAdded = true;
    }

    result.push(line);

    if (isEx) {
      result.push("");
    }

    i++;
  }

  return result.join("\n");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  fixQuestionsFile,
  countQuestions,
  convertFormat,
  EMOJI_NUMBERS,
};
