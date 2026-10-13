// @ts-nocheck
import { executeImage } from "./image";
import { consumeCall, loadStep, saveStep } from "./db";
import { LIMITS, capText, FAILURE_TEXT } from "./limits";
import { degradeLine, sealFacts } from "./facts";

const STYLE_LABEL = { urgent: "限时抢购", warm: "温情居家", pro: "专业科普", redbook: "种草笔记" };
const AUDIENCE_LABEL = { first_home: "首置年轻", upgrade: "家庭改善", luxury: "高端定制" };
const UNSUPPORTED_POINTS = ["环保材质", "包送装", "质保无忧", "终身保修", "免费送装"];

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
    const factLine = facts.sourceExcerpt
      ? `门店资料《${facts.sourceTitle}》：${facts.sourceExcerpt}`
      : "这件商品没有筛选资料，不能编造说明。";
    const bodyText = [
      factLine,
      facts.promoPlan?.note || "",
      degradeLine(sealed.degraded),
      kept.length ? `已选方向：${kept.join("、")}。这些还不是已验证卖点。` : "",
      STYLE_LABEL[form.copyStyle] ? `文案风格：${STYLE_LABEL[form.copyStyle]}。` : "",
      AUDIENCE_LABEL[form.audience] ? `目标客群：${AUDIENCE_LABEL[form.audience]}。` : "",
      refused.length ? `待核对，未写入正文：${refused.join("、")}。资料里没有这些承诺。` : "",
      "演示回放、待核对。",
    ].filter(Boolean).join("");
    const wantsImage = form.outputKind === "image_only" || form.outputKind === "rich";
    let imageCapped = false;
    let imageNetwork = false;
    if (wantsImage) {
      const generated = await executeImage(facts, process.env, fetch, session.id);
      imageCapped = Boolean(generated.capped);
      imageNetwork = Boolean(generated.network);
      session.record.image = {
        simulation: true,
        called: Boolean(generated.called),
        label: "演示回放、待核对",
        product_id: facts.id,
        request: generated.request || null,
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
      cardTitle: "演示回放、待核对",
      bodyTitle: facts.name,
      bodyText: form.outputKind === "image_only" ? "" : bodyText,
      hashtags: [],
      imageSuggestion: "",
      generatedImageUrl: "",
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
