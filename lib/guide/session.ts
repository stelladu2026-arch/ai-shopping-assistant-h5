// @ts-nocheck
import { absorbDemand, acceptProbe, appliedLead, constraintTags, createState, editConstraint, probeLead, productById, publicCatalog } from "./engine";
import { executeImage } from "./image";
import { executeLiveCopy, interpretUtterance, modelStatus } from "./model";
import { reflect } from "./reflect";
import { deleteFavorite, deleteSteps, listFavorites, loadMemory, loadSession, loadStep, loadSteps, nextMemoryId, noteClarify, readCallCounts, readClarifyCounts, resetCallBudgets, saveFavorite, saveMemory, saveSession, saveStep, saveTranscript } from "./db";
import { acquireSharedLease, sharedStorageEnabled } from "./shared-client";
import { FAILURE_TEXT, LIMITS } from "./limits";
import { dropUnverifiedModelText, sealFacts } from "./facts";
import { runGuideGraph } from "./graph";
import { answerStoreDoc, lookupStoreDoc } from "./product-decision";
import { isDroppedStoreQuestion, isStorePolicyQuestion } from "./knowledge";
import { describeProcess } from "./process-view";
import { buildPromoPlan } from "./promos";

function doubtOf(text, pending) {
  if (!pending || /^(参数错误|资料缺失|无结果|网络错误)/.test(pending)) return null;
  if (/便宜点/.test(text) || /具体预算|预算上限|自行降低/.test(pending)) return "预算";
  if (/小户型/.test(text) || /宽度上限/.test(pending)) return "宽度";
  if (/排除的那一种材质/.test(pending)) return "材质";
  return null;
}

function hasShoppingEdit(text) {
  return /预算|便宜|宽度|厘米|cm|不要|排除|换一款|重新选|换一个|改看|小户型|尺寸不限|颜色不限|颜色不变|颜色也可以/.test(String(text || ""));
}

function failureFromLead(lead) {
  const text = String(lead || "");
  if (text.startsWith("无结果")) return { kind: "no_result", text };
  if (text.startsWith("资料缺失")) return { kind: "missing_data", text };
  if (text.startsWith("参数错误")) return { kind: "bad_params", text };
  if (text.startsWith("网络错误")) return { kind: "network", text };
  return null;
}

function blank() {
  return { state: createState(), messages: [], image: null, material: null, transcript: null, offerSwitch: false };
}

function sessionIdFor(raw) {
  return String(raw || "session").replace(/[^\w-]/g, "").slice(0, 80) || "session";
}

async function sessionFor(raw) {
  const id = sessionIdFor(raw);
  return { id, record: (await loadSession(id)) || blank() };
}

// Prevent overlapping mutations within a server instance. Durable cross-instance coordination
// still requires shared storage; this guard does not claim to provide that guarantee.
const activeSessions = globalThis.__guideActiveSessions || (globalThis.__guideActiveSessions = new Set());
const BUSY_TEXT = "当前会话的请求仍在处理中，请等待结果后再操作。未提交新的生成请求。";

function materialFailure(input, text) {
  return {
    scene: "moments_marketing", outputKind: input?.outputKind || "rich",
    cardTitle: "素材没有生成", bodyTitle: "", bodyText: text,
    hashtags: [], imageSuggestion: "", generatedImageUrl: "", generatedImageUrls: [],
    image_urls_text: "", imagePlaceholder: input?.outputKind === "copy_only" ? "" : text,
    commentThreadScript: "",
  };
}

function sessionMemory(memory, id) {
  if (!memory.sessions[id]) memory.sessions[id] = [];
  return memory.sessions[id];
}

async function makeMemory(scope, customerId, key, value) {
  return {
    id: (await nextMemoryId()),
    scope,
    customer_id: scope === "guide" ? null : customerId,
    session_id: scope === "guide" ? null : customerId,
    key: String(key || "").slice(0, 40),
    value: String(value || "").slice(0, 240),
    status: "remembered",
    verified: false,
    promoted: false,
    note: "这是记下的经验，不是已验证事实，也不会自动升成筛选规则。",
  };
}

async function persist(session, memory, preserveTranscript = false) {
  if (preserveTranscript && !sharedStorageEnabled()) {
    const latest = (await loadSession(session.id));
    if (latest) {
      session.record.transcript = latest.transcript;
      session.record.customerName = latest.customerName;
    }
  }
  (await saveSession(session.id, session.record, { preserveTranscript }));
  if (memory) (await saveMemory(memory));
}

function guideTone(memory) {
  return memory.guide.find((item) => item.key === "语气")?.value || null;
}

function visibleMemory(memory, sessionId) {
  const prior = [];
  for (const [id, list] of Object.entries(memory.sessions || {})) {
    if (id === sessionId) continue;
    for (const item of list) prior.push({ ...item, verified: false, fromSession: id });
  }
  return { guide: memory.guide, task: sessionMemory(memory, sessionId), prior };
}

function retrievalOf(steps, decision) {
  const routeOut = steps.route?.output || {};
  if (routeOut.retrieval) return routeOut.retrieval;
  if ((routeOut.entered || []).includes("product_decision")) return decision?.retrieveTrace || null;
  return null;
}

async function snapshot(session, memory) {
  const state = session.record.state;
  const steps = (await loadSteps(session.id));
  const [usage, clarify] = steps.route
    ? await Promise.all([readCallCounts(session.id), readClarifyCounts(session.id)])
    : [null, null];
  const decision = steps.product_decision?.output || steps.research?.output;
  const facts = decision?.confirmedFacts?.id === state.confirmed_product_id ? decision.confirmedFacts : null;
  const reflection = reflect(state, facts);
  const reasonById = new Map((decision?.products || []).map((item) => [item.id, item.reason]));
  const sourceIds = state.confirmed_product_id && !session.record.offerSwitch ? [] : state.candidate_ids || [];
  const products = sourceIds.map((id) => {
    const product = productById(id);
    if (!product) return null;
    const plan = buildPromoPlan(product.id);
    const promoUse = plan.use.length
      ? plan.use.map((item) => `${item.id} 减 ${item.discount_cny} 元`).join("、")
      : "没有可同时使用的活动";
    return {
      id: product.id,
      name: product.name,
      model: product.model,
      category: product.category,
      price_cny: product.price_cny,
      color: product.color,
      width_cm: product.width_cm,
      material: product.material,
      style: product.style || "",
      image: product.image || `/products/${product.id}.png`,
      promoUse,
      detailNote: plan.note,
      reason: reasonById.get(product.id) || "没有检索到这件商品的门店资料，不能编造说明。",
      failed: reflection.failed_targets?.includes(product.id),
    };
  }).filter(Boolean);
  const confirmed = state.confirmed_product_id ? productById(state.confirmed_product_id) : null;
  return {
    scene: "guide_turn",
    customerId: session.id,
    customerName: "当前会话",
    revision: state.revision,
    constraints: state.constraints,
    constraintTags: constraintTags(state),
    probe: state.probe?.needsConfirm
      ? {
          needsConfirm: true,
          label: state.probe.label,
          options: (state.probe.options || []).map((item) => ({ field: item.field, label: item.label, count: item.ids.length })),
          ids: [],
          count: 0,
        }
      : state.probe?.field
        ? { needsConfirm: false, field: state.probe.field, label: state.probe.label, ids: state.probe.ids || [], count: (state.probe.ids || []).length, options: [] }
        : null,
    basis: steps.route?.output?.note || steps.coordinate?.output?.basis || "",
    mode: modelStatus().mode,
    products,
    offerSwitch: Boolean(session.record.offerSwitch && state.confirmed_product_id),
    confirmedId: state.confirmed_product_id,
    confirmedName: confirmed?.name || null,
    confirmedFacts: facts
      ? {
          id: facts.id,
          name: facts.name,
          model: facts.model,
          price_cny: facts.price_cny,
          width_cm: facts.width_cm,
          color: facts.color,
          material: facts.material,
          style: facts.style || "",
          promoNote: facts.promoPlan?.note || "",
        }
      : null,
    candidateIds: state.candidate_ids || [],
    pendingQuestion: state.pending_question,
    copyRequirement: state.copy_requirement,
    material: session.record.material
      ? {
          bodyTitle: session.record.material.bodyTitle || "",
          bodyText: session.record.material.bodyText || "",
          pendingReview: Boolean(session.record.material.pendingReview),
          reviewNote: session.record.material.reviewNote || "",
          generatedImageUrl: session.record.material.generatedImageUrl || "",
        }
      : null,
    copyText: state.card?.text || null,
    copySimulation: state.card ? Boolean(state.card.simulation) : true,
    promotions: state.card?.promotions || [],
    promoPlan: facts?.promoPlan || null,
    image:
      session.record.image && session.record.image.product_id === state.confirmed_product_id
        ? { label: session.record.image.label, called: session.record.image.called, url: session.record.image.url || "" }
        : null,
    reflection,
    process: steps.route
      ? describeProcess({
          edge: steps.route?.output?.edge || (state.pending_question ? "ask" : "stay"),
          note: steps.route?.output?.note || "",
          state,
          facts,
          material: session.record.material,
          decision,
          contentStatus: steps.content?.status || null,
          productStatus: steps.product_decision?.status || null,
          usage,
          clarify,
          failure: session.record.failure || null,
          degraded: facts ? sealFacts(facts, facts.promoPlan).degraded : [],
          retrieval: retrievalOf(steps, decision),
        })
      : null,
    memories: visibleMemory(memory, session.id),
    guideTone: guideTone(memory),
    catalog: publicCatalog(),
  };
}

async function maybeLiveCopy(result) {
  const status = modelStatus();
  if (!result.ok || !result.composed || !result.state?.card || !status.ready) return result;
  const product = productById(result.state.confirmed_product_id);
  const live = await executeLiveCopy({
    product,
    maxChars: result.state.copy_requirement?.max_chars || 200,
    factIds: [product.id],
    promotions: result.state.card.promotions,
  });
  if (!live.payload) {
    result.state.card = null;
    result.reply = "真实模型没有返回可用文案，已停止。没有用演示稿冒充模型结果。";
    return result;
  }
  let payload;
  try {
    const raw = live.payload;
    payload = JSON.parse(raw.choices?.[0]?.message?.content || "");
  } catch {
    result.state.card = null;
    result.reply = "真实模型输出无法解析，已停止。没有用演示稿冒充模型结果。";
    return result;
  }
  const sealed = sealFacts(product, null);
  const stripped = dropUnverifiedModelText(String(payload.text || ""), sealed);
  const text = stripped.text;
  const grounded = text.includes(product.name) && (sealed.facts.price_cny == null || text.includes(String(product.price_cny)) || text.includes("未核对"));
  const clean = !["终身保修", "免费送装", "环保", "舒适", "终身质保"].some((item) => text.includes(item));
  if (!grounded || !clean) {
    result.state.card = null;
    result.reply = "真实模型文案没有通过事实校验，已停止。没有用演示稿冒充模型结果。";
    return result;
  }
  result.state.card = { ...result.state.card, text, simulation: false, pending_human: true };
  result.reply = "模型已生成文案，仍需你在页面上核对后采用。";
  return result;
}

function graphView(ran) {
  return {
    edge: ran?.edge || null,
    entered: ran?.entered || [],
    runtime: ran?.runtime || null,
    modelCalled: false,
  };
}

export async function guideMaterial(input, sessionId, options = {}) {
  const id = sessionIdFor(sessionId);
  if (activeSessions.has(id)) return materialFailure(input, BUSY_TEXT);
  activeSessions.add(id);
  let lease;
  try {
    lease = await acquireSharedLease(`session:${id}`);
    if (!lease) return materialFailure(input, BUSY_TEXT);
    return await runMaterial(input, id, options, lease);
  } finally {
    await lease?.release();
    activeSessions.delete(id);
  }
}

async function runMaterial(input, sessionId, options = {}, lease = null) {
  const session = (await sessionFor(sessionId));
  const ran = await runGuideGraph(session, {
    intent: "content",
    momentsInput: input,
    newPiece: options?.newPiece === true,
    pieceId: options?.pieceId || "",
  });
  await lease?.assertOwned();
  (await persist(session, null, true));
  if (ran.capped) {
    return {
      scene: "moments_marketing",
      outputKind: input?.outputKind || "rich",
      cardTitle: "已达本次上限",
      bodyTitle: "",
      bodyText: ran.reply || "",
      hashtags: [],
      imageSuggestion: "",
      generatedImageUrl: "",
      generatedImageUrls: [],
      image_urls_text: "",
      imagePlaceholder: ran.reply || "",
      commentThreadScript: "",
      graph: graphView(ran),
    };
  }
  if (!ran.ok) {
    if (ran.error === "image_failed") {
      return { ...materialFailure(input, ran.reply || "配图没有生成，请核对本次错误提示。"), graph: graphView(ran) };
    }
    return {
      scene: "moments_marketing",
      outputKind: input?.outputKind || "rich",
      cardTitle: "素材没有生成",
      bodyTitle: "",
      bodyText: ran.error === "need_confirm" ? "先点选确认商品，再生成素材。" : "素材没有生成，可以再试一次。已确认商品还在。",
      imagePlaceholder: input?.outputKind === "copy_only" ? "" : (ran.error === "need_confirm"
        ? "尚未调用生图接口：请先确认商品，再提交生成配图或图文。"
        : "尚未完成生图：素材流程未完成，请查看本次错误提示。"),
      hashtags: [],
      imageSuggestion: "",
      generatedImageUrl: "",
      generatedImageUrls: [],
      image_urls_text: "",
      commentThreadScript: "",
      graph: graphView(ran),
    };
  }
  return { ...ran.output, graph: graphView(ran) };
}

export async function guideAct(body) {
  const id = sessionIdFor(body.sessionId || body.customerId || body.customer_id);
  if (["status", "load", "sync", "lookup"].includes(body.action)) return runAction(body);
  if (activeSessions.has(id)) return { ok: false, error: "session_busy", leadText: BUSY_TEXT };
  activeSessions.add(id);
  let lease;
  let memoryLease;
  try {
    lease = await acquireSharedLease(`session:${id}`);
    if (!lease) return { ok: false, error: "session_busy", leadText: BUSY_TEXT };
    if (["remember", "delete-memory"].includes(body.action)) {
      memoryLease = await acquireSharedLease("memories");
      if (!memoryLease) return { ok: false, error: "session_busy", leadText: "记忆正在更新，请稍后再操作。" };
    }
    return await runAction(body, lease);
  } finally {
    await memoryLease?.release();
    await lease?.release();
    activeSessions.delete(id);
  }
}

async function runAction(body, lease = null) {
  if (body.action === "lookup") return await lookupStoreDoc(body.query || body.text);
  const memory = (await loadMemory());
  const session = (await sessionFor(body.sessionId || body.customerId || body.customer_id));
  const action = body.action || "turn";
  let result;
  if (action === "reset") {
    session.record = blank();
    (await deleteSteps(session.id));
    (await resetCallBudgets(session.id));
    result = { ok: true, leadText: "已清空这次选品。", structured: (await snapshot(session, memory)), steps: (await loadSteps(session.id)) };
  } else if (action === "status") {
    result = { ok: true, leadText: null, structured: (await snapshot(session, memory)), memory, steps: (await loadSteps(session.id)) };
  } else if (action === "sync") {
    session.record.transcript = body.transcript || null;
    if (body.customerName != null) session.record.customerName = String(body.customerName || "").trim().slice(0, 20);
    await saveTranscript(session.id, session.record);
    result = { ok: true, leadText: null };
  } else if (action === "load") {
    result = { ok: true, transcript: session.record.transcript || null, structured: (await snapshot(session, memory)) };
  } else if (action === "favorite") {
    const row = {
      id: String(body.id || `fav_${Date.now()}`),
      source_message_id: String(body.sourceMessageId || ""),
      session_id: session.id,
      kind: body.kind === "product" ? "product" : "material",
      title: String(body.title || "收藏").slice(0, 80),
      content_plain: String(body.contentPlain || "").slice(0, 2000),
      payload_json: "",
      created_at: Date.now(),
    };
    (await saveFavorite(row));
    result = { ok: true, leadText: "已收藏。", favorite: row };
  } else if (action === "unfavorite") {
    (await deleteFavorite(String(body.id || body.sourceMessageId || "")));
    result = { ok: true, leadText: "已取消收藏。" };
  } else if (action === "remember") {
    const scope = body.scope === "guide" ? "guide" : "customer";
    const bucket = scope === "guide" ? memory.guide : sessionMemory(memory, session.id);
    if (body.tone === "简洁" || body.tone === "热情") {
      const existing = memory.guide.find((item) => item.key === "语气");
      if (existing) existing.value = body.tone;
      else memory.guide.push((await makeMemory("guide", null, "语气", body.tone)));
    } else {
      bucket.push((await makeMemory(scope, session.id, body.key, body.value)));
    }
    result = { ok: true, leadText: "已记住。这条记忆未验证，不会变成筛选规则。", structured: (await snapshot(session, memory)), memory };
  } else if (action === "delete-memory") {
    if (!body.id) memory.guide = memory.guide.filter((item) => item.key !== "语气");
    else {
      memory.guide = memory.guide.filter((item) => item.id !== body.id);
      for (const key of Object.keys(memory.sessions)) {
        memory.sessions[key] = memory.sessions[key].filter((item) => item.id !== body.id);
      }
    }
    result = { ok: true, leadText: "已删除这条记忆。", structured: (await snapshot(session, memory)), memory };
  } else if (action === "image") {
    if (session.record.state.revision !== Number(body.revision)) {
      return { ok: false, error: "revision_conflict", structured: (await snapshot(session, memory)) };
    }
    const product = productById(session.record.state.confirmed_product_id);
    if (!product) return { ok: false, error: "need_confirm", leadText: "先点选确认商品，再准备配图。", structured: (await snapshot(session, memory)) };
    const generated = await executeImage(product, process.env, fetch, session.id);
    if (generated.network) session.record.failure = { kind: "network", text: FAILURE_TEXT.network };
    session.record.image = {
      simulation: generated.simulation,
      called: generated.called,
      pending_human: true,
      label: generated.label,
      product_id: product.id,
      url: generated.url || "",
      request: generated.request,
    };
    result = {
      ok: true,
      leadText: generated.capped ? generated.label : generated.network ? FAILURE_TEXT.network : generated.url ? "配图已返回，仍待核对。" : (generated.label || "没有调用生图接口。"),
      structured: (await snapshot(session, memory)),
    };
  } else if (action === "confirm") {
    const confirmedBefore = session.record.state.confirmed_product_id;
    const ran = await runGuideGraph(session, {
      intent: "confirm",
      productId: body.productId || body.product_id,
      source: body.source === "catalog" ? "catalog" : undefined,
      revision: body.revision == null ? session.record.state.revision : Number(body.revision),
    });
    if (!ran.ok) {
      return {
        ok: false,
        error: ran.error,
        graph: graphView(ran),
        steps: (await loadSteps(session.id)),
        structured: (await snapshot(session, memory)),
        confirmedUnchanged: session.record.state.confirmed_product_id === confirmedBefore,
      };
    }
    session.record.offerSwitch = false;
    result = {
      ok: true,
      leadText: ran.reply,
      graph: graphView(ran),
      structured: (await snapshot(session, memory)),
      steps: (await loadSteps(session.id)),
    };
  } else if (action === "rerun-research") {
    const confirmedBefore = session.record.state.confirmed_product_id;
    const materialBefore = session.record.material?.bodyText || "";
    const ran = await runGuideGraph(session, {
      intent: "product_decision",
      constraints: body.constraints,
      forceFail: Boolean(body.forceFail),
    });
    if (ran.ok && !ran.capped && session.record.state.confirmed_product_id) session.record.offerSwitch = true;
    result = {
      ok: ran.ok,
      leadText: ran.capped ? ran.reply : ran.ok ? "已按当前条件重新筛选。已确认商品和已有素材都还在。" : "筛选没有完成，可以再试一次。已确认商品和已有素材都还在。",
      graph: graphView(ran),
      structured: (await snapshot(session, memory)),
      steps: (await loadSteps(session.id)),
      confirmedUnchanged: session.record.state.confirmed_product_id === confirmedBefore,
      materialKept: (session.record.material?.bodyText || "") === materialBefore,
    };
  } else if (action === "rerun-content") {
    const confirmedBefore = session.record.state.confirmed_product_id;
    const candidatesBefore = JSON.stringify(session.record.state.candidate_ids || []);
    const materialBefore = session.record.material?.bodyText || "";
    const ran = await runGuideGraph(session, {
      intent: "content",
      momentsInput: body.momentsInput || {},
      forceFail: Boolean(body.forceFail),
    });
    if (ran.failure === "network") session.record.failure = { kind: "network", text: FAILURE_TEXT.network };
    else if (ran.ok) session.record.failure = null;
    result = {
      ok: ran.ok,
      leadText: ran.capped ? ran.reply : ran.ok ? "素材已重新生成，请核对后再复制发给顾客。" : ran.error === "need_confirm" ? "先点选确认商品，再生成素材。" : ran.reply || (ran.failure === "network" ? FAILURE_TEXT.network : "素材没有生成，可以再试一次。已确认商品还在。"),
      graph: graphView(ran),
      structured: ran.output ? { ...(await snapshot(session, memory)), material: (await snapshot(session, memory)).material, moments: ran.output } : (await snapshot(session, memory)),
      moments: ran.output || null,
      steps: (await loadSteps(session.id)),
      confirmedId: session.record.state.confirmed_product_id,
      confirmedUnchanged: session.record.state.confirmed_product_id === confirmedBefore,
      candidatesUnchanged: JSON.stringify(session.record.state.candidate_ids || []) === candidatesBefore,
      materialKept: (session.record.material?.bodyText || "") === materialBefore,
    };
  } else if (action === "edit-constraint" || action === "accept-probe") {
    const revision = body.revision == null ? session.record.state.revision : Number(body.revision);
    const edited = action === "accept-probe"
      ? acceptProbe(session.record.state, revision, body.field)
      : editConstraint(session.record.state, body, revision);
    if (!edited.ok) return { ok: false, error: edited.error, structured: (await snapshot(session, memory)) };
    const previousConfirmed = session.record.state.confirmed_product_id;
    if (session.record.material?.bodyText && previousConfirmed && !edited.state.confirmed_product_id) {
      session.record.material = {
        ...session.record.material,
        pendingReview: true,
        reviewNote: "条件已变，上一套文案和配图待核对。下一步：重新确认商品后，点重新生成素材。",
      };
    }
    session.record.state = edited.state;
    session.record.offerSwitch = false;
    const ran = await runGuideGraph(session, { intent: "turn", needsResearch: edited.needsResearch, text: "" });
    let lead = "";
    if (ran.capped) lead = ran.reply;
    else if (!ran.ok) lead = "筛选没有完成，可以再试一次。";
    else if (session.record.state.pending_question) lead = session.record.state.pending_question;
    else if (!session.record.state.candidate_ids.length) {
      const probed = probeLead(session.record.state.probe);
      session.record.state.pending_question = probed || FAILURE_TEXT.no_result;
      lead = session.record.state.pending_question;
    } else lead = "条件已按你的修改重新筛选。请点选要确认的商品。";
    session.record.failure = failureFromLead(lead);
    result = {
      ok: true,
      leadText: lead,
      graph: graphView(ran),
      structured: (await snapshot(session, memory)),
      steps: (await loadSteps(session.id)),
    };
  } else {
    const text = String(body.text || "");
    const previousConfirmed = session.record.state.confirmed_product_id;
    const previous = session.record.state;
    let interpretation = null;
    try {
      interpretation = await interpretUtterance(text);
    } catch {
      interpretation = null;
    }
    const absorbed = absorbDemand(session.record.state, text, body.revision == null ? session.record.state.revision : Number(body.revision), interpretation);
    if (!absorbed.ok) return { ok: false, error: absorbed.error, structured: (await snapshot(session, memory)) };
    const policyAside = isStorePolicyQuestion(text) && !hasShoppingEdit(text);
    const storeDoc = policyAside || (!absorbed.changed && isDroppedStoreQuestion(text, absorbed.state.pending_question));
    if (storeDoc) {
      absorbed.state.candidate_ids = previous.candidate_ids;
      absorbed.state.confirmed_product_id = previous.confirmed_product_id;
      absorbed.state.confirmed_product_version = previous.confirmed_product_version;
      absorbed.state.card = previous.card;
      absorbed.state.constraints = previous.constraints;
      absorbed.state.demand_clarification = previous.demand_clarification;
      absorbed.state.pending_question = previous.pending_question;
      absorbed.state.probe = previous.probe;
      absorbed.state.applied_preference = previous.applied_preference;
      absorbed.state.constraint_roles = previous.constraint_roles;
      absorbed.reply = "";
      absorbed.changed = false;
    }
    if (session.record.material?.bodyText && previousConfirmed && !absorbed.state.confirmed_product_id) {
      session.record.material = {
        ...session.record.material,
        pendingReview: true,
        reviewNote: "条件已变，上一套文案和配图待核对。下一步：重新确认商品后，点重新生成素材。",
      };
    }
    const doubt = doubtOf(text, absorbed.state.pending_question);
    if (doubt) {
      const rounds = (await noteClarify(session.id, doubt));
      if (rounds > LIMITS.clarify) {
        const stopped = `${doubt}这一项仍缺，不能替你编一个数。可以改用别的条件，或点选商品。`;
        absorbed.state.pending_question = stopped;
        absorbed.reply = stopped;
      }
    }
    session.record.state = absorbed.state;
    session.record.offerSwitch = false;
    const ran = await runGuideGraph(session, {
      intent: "turn",
      needsResearch: storeDoc ? false : (!absorbed.state.pending_question && !absorbed.state.confirmed_product_id && absorbed.changed),
      text,
    });
    let lead = absorbed.reply || ran.reply || "";
    if (ran.capped) lead = ran.reply;
    else if (ran.edge === "product_decision") {
      if (!ran.ok) lead = "筛选没有完成，可以再试一次。";
      else if (!session.record.state.candidate_ids.length) {
        const probed = probeLead(session.record.state.probe);
        session.record.state.pending_question = probed || FAILURE_TEXT.no_result;
        session.record.failure = session.record.state.probe?.needsConfirm ? null : { kind: "no_result", text: session.record.state.pending_question };
        lead = session.record.state.pending_question;
      } else if (!session.record.state.confirmed_product_id) {
        lead = appliedLead(session.record.state.applied_preference) || "请点选要确认的商品。";
      }
      else lead = "商品仍以页面确认为准。";
    } else if (ran.edge === "stay") {
      lead = "商品已确认。下一步去生成素材。这里不会重新筛选。";
    } else if (ran.edge === "blocked") {
      lead = "还没有确认商品，不能生成素材。";
    }
    if (/发布|下单/.test(text) && !absorbed.changed) {
      lead = "不能代为发布或下单。请先说明要看的商品条件。";
    }
    if (storeDoc) {
      const answered = await answerStoreDoc(session.id, text);
      const row = (await loadStep(session.id, "route"));
      if (row && answered.trace) {
        (await saveStep(session.id, "route", {
          status: "completed",
          input: row.input,
          output: { ...(row.output || {}), retrieval: answered.trace },
          error: null,
        }));
      }
      lead = answered.text;
    }
    session.record.failure = failureFromLead(lead);
    result = {
      ok: true,
      leadText: lead,
      graph: graphView(ran),
      structured: (await snapshot(session, memory)),
      steps: (await loadSteps(session.id)),
    };
  }
  if (action !== "status" && action !== "load" && action !== "sync") {
    await lease?.assertOwned();
    (await persist(session, ["remember", "delete-memory"].includes(action) ? memory : null, action !== "sync" && action !== "reset"));
  }
  return result;
}

export async function guideMemoryBook() {
  const memory = (await loadMemory());
  return {
    guideTone: guideTone(memory),
    memory: { guide: memory.guide, sessions: memory.sessions },
    favorites: (await listFavorites()),
  };
}
