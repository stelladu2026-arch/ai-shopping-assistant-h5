// @ts-nocheck
import { executeImage } from "./image";
import { executeLiveCopy, modelStatus } from "./model";
import { consumeCall, loadStep, saveStep } from "./db";
import { DEGRADE_TEXT, LIMITS, capText, FAILURE_TEXT } from "./limits";
import { degradeLine, dropUnverifiedModelText, sealFacts } from "./facts";

// 内容节点不检索门店资料，也不调用飞书同步。资料只使用商品决策已经读过的摘录。
const STYLE_LABEL = { urgent: "限时抢购", warm: "温情居家", pro: "专业科普", redbook: "种草笔记" };
const AUDIENCE_LABEL = { first_home: "首置年轻", upgrade: "家庭改善", luxury: "高端定制" };
const UNSUPPORTED_POINTS = ["环保材质", "包送装", "质保无忧", "终身保修", "免费送装"];
const BANNED_COPY = ["终身保修", "免费送装", "环保", "舒适", "终身质保"];

async function acceptedLiveCopy(facts, sealed, refused) {
  if (!modelStatus(process.env).ready) return "";
  let live;
  try {
    live = await executeLiveCopy({
      product: {
        id: facts.id,
        name: facts.name,
        model: sealed.facts.model,
        price_cny: sealed.facts.price_cny,
        width_cm: sealed.facts.width_cm,
        material: sealed.facts.material,
        color: sealed.facts.color,
      },
      promoNote: facts.promoPlan?.note || "",
      sourceExcerpt: facts.sourceConflict ? "" : (facts.sourceExcerpt || ""),
      maxChars: 200,
      factIds: [facts.id],
      refusedClaims: refused,
    }, process.env, fetch);
  } catch {
    return "";
  }
  if (!live?.response) return "";
  try {
    const raw = await live.response.json();
    const payload = JSON.parse(raw?.choices?.[0]?.message?.content || "");
    const used = Array.isArray(payload.used_fact_ids) ? payload.used_fact_ids.map((item) => String(item)) : [];
    if (used.some((id) => id !== facts.id)) return "";
    const stripped = dropUnverifiedModelText(String(payload.text || ""), sealed);
    const text = stripped.text.trim();
    if (!text || text.length > 200) return "";
    const price = sealed.facts.price_cny;
    const grounded = text.includes(facts.name)
      && (price == null || text.includes(String(price)) || text.includes("未核对"));
    const clean = !BANNED_COPY.some((item) => text.includes(item));
    const refusedHit = refused.some((item) => item && text.includes(item));
    if (!grounded || !clean || refusedHit) return "";
    return text;
  } catch {
    return "";
  }
}

export async function runContentNode(session, request) {
  const confirmedId = session.record.state.confirmed_product_id || null;
  const candidatesBefore = JSON.stringify(session.record.state.candidate_ids || []);
  const facts = loadStep(session.id, "product_decision")?.output?.confirmedFacts || null;
  const form = {
    outputKind: request?.momentsInput?.outputKind || session.record.materialInput?.outputKind || "rich",
    productName: request?.momentsInput?.productName || session.record.materialInput?.productName || "",
    sellingPoints: request?.momentsInput?.sellingPoints || session.record.materialInput?.sellingPoints || [],
    copyStyle: request?.momentsInput?.copyStyle || session.record.materialInput?.copyStyle || "warm",
    audience: request?.momentsInput?.audience || session.record.materialInput?.audience || "first_home",
  };
  const gate = consumeCall(session.id, "content", LIMITS.content);
  if (!gate.ok) {
    return { ok: true, capped: true, reply: capText("content") };
  }
  saveStep(session.id, "content", {
    status: "running",
    input: { form, confirmedId, searchedProducts: false },
    error: null,
  });
  if (request?.forceFail) {
    saveStep(session.id, "content", {
      status: "failed",
      input: { form, confirmedId, searchedProducts: false },
      keepOutput: true,
      error: "素材没有生成，可以再试一次。",
    });
    return { ok: false, error: "content_failed" };
  }
  if (!confirmedId || !facts || facts.id !== confirmedId) {
    saveStep(session.id, "content", {
      status: "failed",
      input: { form, confirmedId, searchedProducts: false },
      keepOutput: true,
      error: "先点选确认商品，再生成素材。",
    });
    return { ok: false, error: "need_confirm" };
  }
  try {
    const points = Array.isArray(form.sellingPoints) ? form.sellingPoints.map((item) => String(item)) : [];
    const refused = points.filter((item) => UNSUPPORTED_POINTS.some((word) => item.includes(word)));
    const kept = points.filter((item) => !refused.includes(item));
    const sealed = sealFacts(
      {
        name: facts.name,
        model: facts.model,
        price_cny: facts.price_cny,
        width_cm: facts.width_cm,
        material: facts.material,
        color: facts.color,
      },
      facts.promoPlan,
    );
    const factLine = facts.sourceConflict
      ? `门店资料与商品目录不一致。${DEGRADE_TEXT}`
      : facts.sourceExcerpt
        ? `门店资料《${facts.sourceTitle}》：${facts.sourceExcerpt}`
        : "这件商品没有筛选资料，不能编造说明。";
    let bodyText = [
      factLine,
      facts.promoPlan?.note || "",
      degradeLine(sealed.degraded),
      kept.length ? `已选方向：${kept.join("、")}。这些还不是已验证卖点。` : "",
      STYLE_LABEL[form.copyStyle] ? `文案风格：${STYLE_LABEL[form.copyStyle]}。` : "",
      AUDIENCE_LABEL[form.audience] ? `目标客群：${AUDIENCE_LABEL[form.audience]}。` : "",
      refused.length ? `待核对，未写入正文：${refused.join("、")}。资料里没有这些承诺。` : "",
      "演示回放、待核对。",
    ].filter(Boolean).join("");
    const liveText = form.outputKind === "image_only" ? "" : await acceptedLiveCopy(facts, sealed, refused);
    if (liveText) bodyText = liveText;
    const wantsImage = form.outputKind === "image_only" || form.outputKind === "rich";
    let imageCapped = false;
    let imageNetwork = false;
    let imageUrl = "";
    let imagePlaceholder = "";
    if (wantsImage) {
      let generated;
      try {
        generated = await executeImage(facts, process.env, fetch, session.id);
      } catch {
        generated = {simulation: false, called: true, url: "", label: "返回里没有图片地址"};
      }
      imageCapped = Boolean(generated.capped);
      imageNetwork = Boolean(generated.network) && !generated.quota;
      imageUrl = generated?.url && !generated.simulation && !generated.quota && !generated.capped && !generated.network
        ? String(generated.url)
        : "";
      imagePlaceholder = imageUrl
        ? ""
        : String(generated.label || (generated.called ? "返回里没有图片地址" : "没有调用生图接口"));
      session.record.image = {
        simulation: !imageUrl,
        called: Boolean(generated.called),
        label: imageUrl ? (generated.label || "待核对") : imagePlaceholder,
        product_id: facts.id,
        request: generated.request || null,
        url: imageUrl,
      };
    }
    if (session.record.state.confirmed_product_id !== confirmedId) {
      throw new Error("confirmed_product_changed");
    }
    if (JSON.stringify(session.record.state.candidate_ids || []) !== candidatesBefore) {
      throw new Error("candidates_changed");
    }
    const result = {
      scene: "moments_marketing",
      outputKind: form.outputKind,
      cardTitle: liveText ? "待核对" : "演示回放、待核对",
      bodyTitle: facts.name,
      bodyText: form.outputKind === "image_only" ? "" : bodyText,
      hashtags: [],
      imageSuggestion: "",
      generatedImageUrl: imageUrl,
      imagePlaceholder,
      commentThreadScript: "",
      pendingReview: false,
      usedProductId: facts.id,
      ignoredUnconfirmedName: form.productName && form.productName !== facts.name ? form.productName : "",
      degraded: sealed.degraded,
      failure: imageNetwork ? "network" : null,
    };
    if (imageNetwork) result.bodyText = `${result.bodyText}${FAILURE_TEXT.network}`;
    if (imageCapped) result.bodyText = `${result.bodyText}${capText("image")}`;
    session.record.material = result;
    session.record.materialInput = { ...form, productName: facts.name };
    saveStep(session.id, "content", {
      status: "completed",
      input: { form, confirmedId, searchedProducts: false },
      output: result,
      error: null,
    });
    return { ok: true, output: result, failure: result.failure };
  } catch (error) {
    saveStep(session.id, "content", {
      status: "failed",
      input: { form, confirmedId, searchedProducts: false },
      keepOutput: true,
      error: "素材没有生成，可以再试一次。",
    });
    return { ok: false, error: error?.message || "content_failed" };
  }
}
