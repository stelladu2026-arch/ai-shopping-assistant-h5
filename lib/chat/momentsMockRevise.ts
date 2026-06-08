import type { AgentChatMessagePayload, MomentsGenerationInput, MomentsGenerationResult } from "@/types/agent";

function lineValue(content: string, label: string): string | undefined {
  const re = new RegExp(`^${label}：(.+)$`, "m");
  const m = content.match(re);
  return m?.[1]?.trim();
}

/** 从助手气泡正文（stringifyStructuredBlock 格式）还原上一版朋友圈结果 */
export function parseMomentsFromAssistantContent(
  content: string,
  fallbackKind: MomentsGenerationInput["outputKind"],
): MomentsGenerationResult | null {
  if (!content.includes("【场景】朋友圈营销")) return null;
  const kindMatch = content.match(/类型：(仅文案|仅配图|图文)/);
  const outputKind =
    kindMatch?.[1] === "仅文案"
      ? "copy_only"
      : kindMatch?.[1] === "仅配图"
        ? "image_only"
        : fallbackKind;
  const hashtagsRaw = lineValue(content, "话题");
  const hashtags = hashtagsRaw
    ? hashtagsRaw
        .split(/\s+/)
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .filter(Boolean)
    : [];
  const imageUrl = lineValue(content, "配图地址");

  return {
    scene: "moments_marketing",
    outputKind,
    cardTitle:
      outputKind === "copy_only"
        ? "文案预览 · 朋友圈"
        : outputKind === "image_only"
          ? "配图预览 · 朋友圈"
          : "图文预览 · 朋友圈",
    bodyTitle: lineValue(content, "标题"),
    bodyText: lineValue(content, "正文"),
    hashtags,
    imageSuggestion: lineValue(content, "配图建议"),
    generatedImageUrl: imageUrl,
    commentThreadScript: lineValue(content, "评论区话术"),
  };
}

export function getLatestUserInstruction(messages: AgentChatMessagePayload[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") {
      const t = typeof m.content === "string" ? m.content.trim() : "";
      if (t) return t;
    }
  }
  return "";
}

export function findPreviousMomentsResult(
  messages: AgentChatMessagePayload[],
  fallbackKind: MomentsGenerationInput["outputKind"],
): MomentsGenerationResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant") {
      const parsed = parseMomentsFromAssistantContent(m.content, fallbackKind);
      if (parsed) return parsed;
    }
  }
  return null;
}

function shortenText(text: string, ratio = 0.55): string {
  const t = text.trim();
  if (t.length <= 24) return t;
  const cut = Math.max(18, Math.floor(t.length * ratio));
  const slice = t.slice(0, cut);
  const breakAt = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("！"), slice.lastIndexOf("～"));
  if (breakAt > 12) return slice.slice(0, breakAt + 1);
  return `${slice}…`;
}

/** 避免 emoji 区间正则（如 [😀-🙏]）在 JS 中报 Range out of order */
const EMOJI_MARK_RE = /[\u2600-\u27BF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|✨|🔥/;

function lengthenText(text: string): string {
  const t = text.trim();
  if (!t) return t;
  if (t.includes("到店")) return `${t} 现在预约还可享免费量尺与方案对比，名额有限～`;
  return `${t} 欢迎私信了解详情，到店体验实物质感更直观～`;
}

/** 根据用户修改指令调整上一版（或基础）朋友圈内容 — Mock / 演示用 */
export function applyMomentsModification(
  base: MomentsGenerationResult,
  instruction: string,
): MomentsGenerationResult {
  const ins = instruction.trim();
  if (!ins) return base;

  let bodyTitle = base.bodyTitle ?? "";
  let bodyText = base.bodyText ?? "";
  let hashtags = [...base.hashtags];
  let comment = base.commentThreadScript ?? "";
  let cardTitle = base.cardTitle.replace(/ · 已修改$/, "");

  if (/活泼|俏皮|有趣|轻松|欢快|可爱/.test(ins)) {
    bodyText = bodyText.replace(/。/g, "！").replace(/~/g, "");
    if (!EMOJI_MARK_RE.test(bodyText)) bodyText += " ✨";
    comment = `嗨～${comment || "感兴趣的朋友评论区扣 1～"}`;
    if (!hashtags.includes("#好物分享")) hashtags = [...hashtags, "#好物分享"];
  }

  if (/缩短|精简|简短|一半|短一点|少字/.test(ins)) {
    bodyText = shortenText(bodyText);
    comment = shortenText(comment, 0.65);
    bodyTitle = bodyTitle.length > 14 ? `${bodyTitle.slice(0, 12)}…` : bodyTitle;
  }

  if (/加长|详细|丰富|多一点|长一点/.test(ins)) {
    bodyText = lengthenText(bodyText);
    comment = lengthenText(comment || "欢迎评论区留言～");
  }

  if (/专业|正式|商务|稳重/.test(ins)) {
    bodyText = bodyText
      .replace(EMOJI_MARK_RE, "")
      .replace(/[～！]/g, "")
      .replace(/来啦来啦/g, "");
    bodyTitle = bodyTitle.replace(/｜门店热推/g, "｜品质推荐");
    comment = comment.replace(/～/g, "。").replace(/！/g, "。");
  }

  if (/温馨|温暖|亲切/.test(ins)) {
    bodyText = bodyText.replace(/您/g, "您").replace(/私信/g, "随时私信我");
    if (!bodyText.includes("家")) bodyText = `给正在选家具的你：${bodyText}`;
  }

  if (/紧迫|促销|限时|秒杀|抢购/.test(ins)) {
    bodyTitle = bodyTitle.includes("限时") ? bodyTitle : `限时｜${bodyTitle}`;
    bodyText = `【本周特惠】${bodyText}`;
    comment = `仅剩少量名额，先到先得！${comment}`;
    if (!hashtags.includes("#限时福利")) hashtags = [...hashtags, "#限时福利"];
  }

  if (/话题|标签| hashtag/i.test(ins) || /加.{0,2}(话题|标签)/.test(ins)) {
    const extra = ["#装修灵感", "#软装搭配", "#家居生活"].filter((t) => !hashtags.includes(t));
    hashtags = [...hashtags, ...extra.slice(0, 2)];
  }

  if (/标题/.test(ins) && /改|换|调整/.test(ins)) {
    const product = bodyTitle.split("｜")[0] || "门店好物";
    bodyTitle = /活泼|俏皮/.test(ins)
      ? `${product}｜真的太好逛了！`
      : /专业|正式/.test(ins)
        ? `${product}｜品质之选`
        : `${product}｜按您要求优化`;
  }

  if (/评论/.test(ins) && /改|换|调整|写/.test(ins)) {
    comment = `【按修改要求】${ins} — ${comment || "欢迎留言互动～"}`;
  }

  const titleMatch = ins.match(/标题[改为改成是:]?\s*[「"']?([^」"'\n]+)[」"']?/);
  if (titleMatch?.[1]) bodyTitle = titleMatch[1].trim();

  const bodyMatch = ins.match(/正文[改为改成是:]?\s*[「"']?([^」"'\n]+)[」"']?/);
  if (bodyMatch?.[1]) bodyText = bodyMatch[1].trim();

  const stillSame =
    bodyTitle === (base.bodyTitle ?? "") &&
    bodyText === (base.bodyText ?? "") &&
    comment === (base.commentThreadScript ?? "") &&
    hashtags.join("|") === base.hashtags.join("|");

  if (stillSame) {
    bodyText = `【已按修改要求调整】${ins}\n${bodyText}`;
  }

  return {
    ...base,
    cardTitle: `${cardTitle} · 已修改`,
    bodyTitle: bodyTitle || base.bodyTitle,
    bodyText: bodyText || base.bodyText,
    hashtags,
    commentThreadScript: comment || base.commentThreadScript,
  };
}

export function buildMomentsMockResponse(
  input: MomentsGenerationInput,
  messages: AgentChatMessagePayload[],
): { structured: MomentsGenerationResult; leadText?: string } {
  const base = buildBaseMomentsMock(input);
  const instruction = getLatestUserInstruction(messages);
  const previous = findPreviousMomentsResult(messages, input.outputKind);

  if (!instruction) {
    return { structured: base };
  }

  const source = previous ?? base;
  const revised =
    source.outputKind === "image_only"
      ? {
          ...source,
          cardTitle: `${source.cardTitle.replace(/ · 已修改$/, "")} · 已修改`,
          imageSuggestion: `【按修改要求：${instruction}】${
            source.imageSuggestion ?? `突出产品氛围与门店实拍质感`
          }`,
        }
      : applyMomentsModification(source, instruction);

  return {
    structured: revised,
    leadText: `已根据您的要求调整：${instruction}`,
  };
}

function buildBaseMomentsMock(input: MomentsGenerationInput): MomentsGenerationResult {
  const pts = input.sellingPoints.length ? input.sellingPoints.join("、") : "品质交付";
  const tags = ["#家居好物", "#门店福利", "#预约有礼"];

  if (input.outputKind === "copy_only") {
    return {
      scene: "moments_marketing",
      outputKind: "copy_only",
      cardTitle: "文案预览 · 朋友圈",
      bodyTitle: `${input.productName}｜门店热推`,
      bodyText: `（Mock）周末到店看「${input.productName}」——${pts}。私信我帮您锁名额，支持预约量尺～`,
      hashtags: tags,
      commentThreadScript: "前 5 位私信的朋友送抱枕一对，名额以私信时间为准～（Mock）",
    };
  }

  const demoImageUrl = "/demo/moments-placeholder.svg";

  if (input.outputKind === "image_only") {
    return {
      scene: "moments_marketing",
      outputKind: "image_only",
      cardTitle: "配图预览 · 朋友圈",
      hashtags: [],
      generatedImageUrl: demoImageUrl,
      imageSuggestion: `突出「${input.productName}」与${pts}的门店实拍氛围`,
    };
  }

  return {
    scene: "moments_marketing",
    outputKind: "rich",
    cardTitle: "图文预览 · 朋友圈",
    bodyTitle: `${input.productName}｜门店热推`,
    bodyText: `（Mock）周末到店看「${input.productName}」——${pts}。私信我帮您锁名额，支持预约量尺～`,
    hashtags: tags,
    commentThreadScript: "前 5 位私信的朋友送抱枕一对～（Mock）",
    generatedImageUrl: demoImageUrl,
  };
}
