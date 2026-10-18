/**
 * 主回复已经说明「资料缺失 / 不编造 / 先补问」时，旁边再贴同一口径的提示框或状态句。
 * 只用于渲染去重，不改后端字段。
 */

const ASK_AGAIN = /资料缺失|不会编造|不编造|先补问|还缺|无结果|不会自行|参数错误|需要确认|不能替你编|仍缺|只能排除一种材质/;

export function normalizeReplyText(text: string) {
  return text.replace(/\s+/g, "").replace(/[「」“”‘’"'，。、：:；;！!？?．，,.]/g, "");
}

export function isAskAgainPoint(text: string) {
  return ASK_AGAIN.test(text);
}

/** 候选文案是否在重复主回复（字面相同，或同属先补问、不编造这一口径）。 */
export function repeatsAssistantReply(extra: string | null | undefined, lead: string | null | undefined) {
  const candidate = String(extra || "").trim();
  const main = String(lead || "").trim();
  if (!candidate || !main) return false;
  const normalizedExtra = normalizeReplyText(candidate);
  const normalizedLead = normalizeReplyText(main);
  if (!normalizedExtra || !normalizedLead) return false;
  if (normalizedExtra === normalizedLead) return true;
  const shorter = normalizedExtra.length <= normalizedLead.length ? normalizedExtra : normalizedLead;
  const longer = shorter === normalizedExtra ? normalizedLead : normalizedExtra;
  if (shorter.length >= 12 && longer.includes(shorter)) return true;
  return isAskAgainPoint(candidate) && isAskAgainPoint(main);
}
