// @ts-nocheck
import { executeImage } from "./image";
import { MARKETING_IMAGE_SHOTS, normalizeImageCount } from "../../server/image-plan.mjs";
import { executeLiveCopy, modelStatus } from "./model";
import { consumeCall, loadStep, releaseCall, resetPieceCalls, saveStep } from "./db";
import { LIMITS, capText, FAILURE_TEXT } from "./limits";
import { dropUnverifiedModelText, sealFacts } from "./facts";

// 内容节点不检索门店资料，也不调用飞书同步。资料只使用商品决策已经读过的摘录。
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
  if (!live?.payload) return "";
  try {
    const raw = live.payload;
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

function rememberMaterial(session, result, request) {
  if (!Array.isArray(session.record.materials)) {
    session.record.materials = session.record.material ? [session.record.material] : [];
  }
  const pieces = session.record.materials;
  if (request?.newPiece) {
    result.pieceId = `piece_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    pieces.push(result);
  } else if (request?.pieceId) {
    result.pieceId = String(request.pieceId);
    const index = pieces.findIndex((item) => item && item.pieceId === result.pieceId);
    if (index >= 0) pieces[index] = result;
    else pieces.push(result);
  } else if (pieces.length) {
    result.pieceId = pieces[pieces.length - 1].pieceId || `piece_${Date.now().toString(36)}`;
    pieces[pieces.length - 1] = result;
  } else {
    result.pieceId = `piece_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    pieces.push(result);
  }
  session.record.material = result;
}

function customerSentence(facts, sealed) {
  const bits = [String(facts.name || "").trim()];
  const look = `${sealed.facts.color || ""}${sealed.facts.material || ""}`;
  if (look) bits.push(look);
  if (sealed.facts.width_cm != null) bits.push(`宽${sealed.facts.width_cm}厘米`);
  if (sealed.facts.price_cny != null) bits.push(`标价${sealed.facts.price_cny}元`);
  return `${bits.filter(Boolean).join("，")}。`;
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
    imageCount: normalizeImageCount(request?.momentsInput?.imageCount ?? session.record.materialInput?.imageCount, 4),
  };
  const readyForProduct = Boolean(confirmedId && facts && facts.id === confirmedId);
  const owners = [session.record.pieceProductId, session.record.material?.usedProductId].filter(Boolean);
  if (readyForProduct && owners.some((id) => id !== confirmedId)) resetPieceCalls(session.id);
  if (readyForProduct) session.record.pieceProductId = confirmedId;
  if (request?.newPiece) resetPieceCalls(session.id);
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
    releaseCall(session.id, "content");
    saveStep(session.id, "content", {
      status: "failed",
      input: { form, confirmedId, searchedProducts: false },
      keepOutput: true,
      error: "素材没有生成，可以再试一次。",
    });
    return { ok: false, error: "content_failed" };
  }
  if (!confirmedId || !facts || facts.id !== confirmedId) {
    releaseCall(session.id, "content");
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
    let bodyText = customerSentence(facts, sealed);
    const liveText = form.outputKind === "image_only" ? "" : await acceptedLiveCopy(facts, sealed, refused);
    if (liveText) bodyText = liveText;
    const wantsImage = form.outputKind === "image_only" || form.outputKind === "rich";
    let imageCapped = false;
    let imageNetwork = false;
    let imageUrl = "";
    let imageUrls = [];
    let imagePlaceholder = "";
    if (wantsImage) {
      let generated;
      try {
        generated = await executeImage(facts, process.env, fetch, session.id, { withinPiece: true, imageCount: form.imageCount });
      } catch {
        generated = {simulation: false, called: true, url: "", label: "返回里没有图片地址"};
      }
      imageCapped = Boolean(generated.capped);
      imageNetwork = Boolean(generated.network) && !generated.quota;
      imageUrl = generated?.url && !generated.simulation && !generated.quota && !generated.capped && !generated.network
        ? String(generated.url)
        : "";
      imageUrls = imageUrl ? (Array.isArray(generated.urls) && generated.urls.length ? generated.urls : [imageUrl]) : [];
      imagePlaceholder = imageUrl
        ? (generated.partial ? generated.label : "")
        : String(generated.label || (generated.called ? "返回里没有图片地址" : "没有调用生图接口"));
      session.record.image = {
        simulation: !imageUrl,
        called: Boolean(generated.called),
        label: imageUrl ? (generated.label || "待核对") : imagePlaceholder,
        product_id: facts.id,
        request: generated.request || null,
        url: imageUrl,
        urls: imageUrls,
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
      cardTitle: "待核对",
      bodyTitle: facts.name,
      bodyText: form.outputKind === "image_only" ? "" : bodyText,
      hashtags: [],
      imageSuggestion: "",
      generatedImageUrl: imageUrl,
      generatedImageUrls: imageUrls,
      image_urls_text: imageUrls.length ? `配图地址：${imageUrls.join(' ')}` : '',
      images: imageUrls.map((url, index) => ({url, ...MARKETING_IMAGE_SHOTS[index]})),
      requestedImageCount: wantsImage ? form.imageCount : 0,
      imagePlaceholder,
      commentThreadScript: "",
      pendingReview: false,
      usedProductId: facts.id,
      ignoredUnconfirmedName: form.productName && form.productName !== facts.name ? form.productName : "",
      degraded: sealed.degraded,
      failure: imageNetwork ? "network" : null,
    };
    if (imageNetwork) result.bodyText = `${result.bodyText}${imagePlaceholder}`;
    if (imageCapped) result.bodyText = `${result.bodyText}${capText("image")}`;
    const producedCopy = form.outputKind !== "image_only" && Boolean(String(bodyText || "").trim());
    if (!producedCopy && !imageUrl) releaseCall(session.id, "content");
    rememberMaterial(session, result, request);
    session.record.materialInput = { ...form, productName: facts.name };
    saveStep(session.id, "content", {
      status: "completed",
      input: { form, confirmedId, searchedProducts: false },
      output: result,
      error: null,
    });
    return { ok: true, output: result, failure: result.failure };
  } catch (error) {
    releaseCall(session.id, "content");
    saveStep(session.id, "content", {
      status: "failed",
      input: { form, confirmedId, searchedProducts: false },
      keepOutput: true,
      error: "素材没有生成，可以再试一次。",
    });
    return { ok: false, error: error?.message || "content_failed" };
  }
}
