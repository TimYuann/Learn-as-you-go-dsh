/**
 * Learn-As-You-Go policy texts (the product idea, byte-exact).
 *
 * These are the two reader-level prompt bodies. They are the "idea" the
 * plugin exists to carry: keep the technical anchor, put the plain-language
 * Chinese meaning directly below it. Frozen bodies — a change to the format
 * is a product decision, and the golden tests keep them honest.
 */

export type ReaderLevel = 1 | 2;

/** L1 prompt body (入门 / Beginner, 30-50 字). */
export const POLICY_TEXT_L1 = `Apply the "Learn As You Go" format to natural-language technical explanations in your final answer. For each technical semantic block, put a "↳ " line DIRECTLY BELOW it with the plain-language Chinese meaning (30-50 字，口语化，可加日常类比，概念性技术词汇全部换成大白话，标识符原样保留).

SCOPE AND PRECEDENCE:
1. Honor the user's requested output shape first. If the user asks for exact JSON/XML/YAML, only code or commands, raw logs, a single exact string, only the technical conclusion, or asks to disable/skip plain-language help for the current request, do NOT add ↳ lines.
2. Never put ↳ inside code fences, shell commands, tables, file paths, URLs, hashes, or exact identifiers. Explain outside only when it helps.
3. Use the same primary language the user requested for generated technical anchors. A Chinese request gets a concise Chinese technical anchor unless the user explicitly asks for English. If a block is already plain Chinese, is non-technical, or contains only identifiers, no ↳ is needed. Never switch languages merely to create a pair.
4. For user-provided source text, preserve the technical source block exactly. For generated explanations, write a concise technical anchor followed by its ↳ line.
5. Each technical paragraph and each technical numbered/bullet item gets its own ↳ line. Keep the ↳ directly below the block it explains. Every ↳ explanation MUST contain 30-50 Chinese characters; for a short source block, spell out the same cause, behavior, or consequence more concretely without inventing facts. Do not shorten Level 1 explanations to the Level 2 range.
6. Do not add facts, risks, certainty, urgency, or stronger modality that the technical block did not contain.

EXAMPLE (exactly this shape — original line first, ↳ directly below):
The retry loop can create duplicate writes because the idempotency key is generated inside the retry callback.
↳ 重试时可能写入重复数据，因为“判断是不是同一次操作”的 key 是每次重试时重新生成的。`;

/** L2 prompt body (标准 / Standard, 15-25 字). */
export const POLICY_TEXT_L2 = `Apply the "Learn As You Go" format to natural-language technical explanations in your final answer. For each technical semantic block, put a "↳ " line DIRECTLY BELOW it with the plain-language Chinese meaning (15-25 字，简短直白，技术名词保留在原文).

SCOPE AND PRECEDENCE:
1. Honor the user's requested output shape first. If the user asks for exact JSON/XML/YAML, only code or commands, raw logs, a single exact string, only the technical conclusion, or asks to disable/skip plain-language help for the current request, do NOT add ↳ lines.
2. Never put ↳ inside code fences, shell commands, tables, file paths, URLs, hashes, or exact identifiers. Explain outside only when it helps.
3. Use the same primary language the user requested for generated technical anchors. A Chinese request gets a concise Chinese technical anchor unless the user explicitly asks for English. If a block is already plain Chinese, is non-technical, or contains only identifiers, no ↳ is needed. Never switch languages merely to create a pair.
4. For user-provided source text, preserve the technical source block exactly. For generated explanations, write a concise technical anchor followed by its ↳ line.
5. A technical paragraph gets one ↳ line. Similar short list items may share one ↳ line immediately after the group; never drop original items. Every ↳ explanation MUST contain 15-25 Chinese characters, excluding preserved identifiers; state only the core meaning or user impact and do not expand it with optional tradeoffs.
6. Do not add facts, risks, certainty, urgency, or stronger modality that the technical block did not contain.

EXAMPLE (exactly this shape):
- Syntax check passed
- Type check passed
- Extension loads under the official jiti loader
↳ 三项检查都通过了。`;

export function policyTextForLevel(level: ReaderLevel): string {
  return level === 1 ? POLICY_TEXT_L1 : POLICY_TEXT_L2;
}

/** Whether a value is a valid reader level. */
export function isReaderLevel(value: unknown): value is ReaderLevel {
  return value === 1 || value === 2;
}

/**
 * Parse a reader level argument. Aliases are case-insensitive:
 *   1 | beginner | 入门 | ru-men     -> 1
 *   2 | standard | 标准 | biao-zhun  -> 2
 * anything else -> null (caller issues the warning).
 */
export function parseReaderLevel(raw: string): ReaderLevel | null {
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "beginner" || v === "入门" || v === "ru-men") return 1;
  if (v === "2" || v === "standard" || v === "标准" || v === "biao-zhun") return 2;
  return null;
}
