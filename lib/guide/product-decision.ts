// @ts-nocheck
import { RAG_TIMEOUT_MS } from "./rag";
import promotions from "../../data/promotions.json";
import { confirmFromCatalog, confirmProduct, productById, resolveConstraintSearch } from "./engine";
import { degradeStoreReason, formatStoreHit, MISS_TEXT, retrieve, storeExcerptConflicts } from "./knowledge";
import { buildPromoPlan } from "./promos";
import { consumeCall, loadStep, resetPieceCalls, saveStep } from "./db";
import { LIMITS, capText } from "./limits";

const STEP = "product_decision";
let latestRetrieveTrace = null;

export async function lookupStoreDoc(query) {
  const hit = await retrieve(query);
  return {
    ok: true,
    found: Boolean(hit),
    source: hit?.source || null,
    text: formatStoreHit(hit),
  };
}

async function readStore(sessionId, query, deadlineAt) {
  const gate = (await consumeCall(sessionId, "retrieve", LIMITS.retrieve));
  if (!gate.ok) return { capped: true, hit: null };
  const hit = await retrieve(query, undefined, { deadlineAt });
  latestRetrieveTrace = retrieve.lastTrace || null;
  return { capped: false, hit };
}

export async function answerStoreDoc(sessionId, query, options = {}) {
  let gate = (await consumeCall(sessionId, "retrieve", LIMITS.retrieve));
  if (!gate.ok) {
    gate = (await consumeCall(sessionId, "policy", LIMITS.policy));
    if (!gate.ok) return { ok: true, found: false, capped: true, text: capText("retrieve"), trace: null };
  }
  const hit = await retrieve(query, options.knowledgeDir, options);
  return {
    ok: true,
    found: Boolean(hit),
    capped: false,
    source: hit?.source || null,
    title: hit?.title || null,
    section: hit?.section || null,
    text: formatStoreHit(hit),
    trace: retrieve.lastTrace || null,
  };
}

function explainStore(read, product) {
  if (read.capped) return { reason: capText("retrieve"), excerpt: null, conflict: false, title: null, source: null };
  const hit = read.hit;
  if (!hit) {
    return { reason: "没有检索到这件商品的门店资料，不能编造说明。", excerpt: null, conflict: false, title: null, source: null };
  }
  if (product && storeExcerptConflicts(hit.excerpt, product)) {
    return { reason: degradeStoreReason(hit.title), excerpt: null, conflict: true, title: hit.title, source: hit.source };
  }
  return { reason: `门店资料《${hit.title}》：${hit.excerpt}`, excerpt: hit.excerpt, conflict: false, title: hit.title, source: hit.source };
}

export function applyStoreExcerpt(product, hit) {
  const explained = explainStore({ capped: false, hit }, product);
  return {
    reason: explained.reason,
    excerpt: explained.excerpt,
    conflict: explained.conflict,
    title: explained.title,
    source: explained.source,
    name: product?.name ?? null,
    model: product?.model ?? null,
    price_cny: product?.price_cny ?? null,
    width_cm: product?.width_cm ?? null,
    color: product?.color ?? null,
    material: product?.material ?? null,
  };
}

async function factsFor(sessionId, productId, plan, deadlineAt) {
  const product = productById(productId);
  if (!product) return null;
  const read = await readStore(sessionId, product.name, deadlineAt);
  const explained = explainStore(read, product);
  const promoPlan = plan || buildPromoPlan(product.id);
  return {
    id: product.id,
    name: product.name,
    model: product.model,
    price_cny: product.price_cny,
    width_cm: product.width_cm,
    color: product.color,
    material: product.material,
    category: product.category,
    style: product.style || "",
    promoPlan,
    sourceTitle: explained.title,
    sourceExcerpt: explained.excerpt,
    sourceFile: explained.source,
    sourceConflict: explained.conflict,
  };
}

function chosenPromotions(plan) {
  return (plan?.use || []).map((item) => {
    const source = promotions.find((promo) => promo.id === item.id);
    return {
      id: item.id,
      discount_cny: item.discount_cny,
      stack_with: source?.stack_with || [],
    };
  });
}

function markPending(session, reviewNote) {
  if (!session.record.material?.bodyText) return;
  session.record.material = {
    ...session.record.material,
    pendingReview: true,
    reviewNote,
  };
}

export async function runProductDecision(session, request) {
  latestRetrieveTrace = null;
  // All candidates share one retrieval deadline; slow services cannot multiply the wait.
  const deadlineAt = Date.now() + RAG_TIMEOUT_MS;
  // 点选已经列出的商品不是一次新的筛选。次数用完之后，仍可以确认当前列表里的一件。
  if (request?.intent !== "confirm") {
    const gate = (await consumeCall(session.id, "product_decision", LIMITS.product_decision));
    if (!gate.ok) {
      return { ok: true, capped: true, reply: capText("product_decision") };
    }
  }
  const previous = (await loadStep(session.id, STEP));
  const constraints = request?.constraints || session.record.state.constraints;
  if (request?.intent === "confirm") {
    const previousId = session.record.state.confirmed_product_id;
    const settled = request.source === "catalog"
      ? confirmFromCatalog(session.record.state, request.productId, request.revision)
      : confirmProduct(session.record.state, request.productId, request.revision);
    if (!settled.ok) return { ok: false, error: settled.error || "confirm_failed" };
      session.record.state = settled.state;
      const facts = await factsFor(session.id, settled.state.confirmed_product_id, previous?.output?.plans?.[settled.state.confirmed_product_id], deadlineAt);
      if (session.record.state.card && facts?.promoPlan) {
        session.record.state.card.promotions = chosenPromotions(facts.promoPlan);
      }
      if (session.record.material?.bodyText && previousId && previousId !== facts?.id) {
        markPending(session, "确认的商品已更换，上一套文案和配图待核对。下一步：点重新生成素材。");
      }
      const nextId = facts?.id || settled.state.confirmed_product_id || null;
      const countedFor = session.record.pieceProductId || previousId || null;
      if (nextId && countedFor && countedFor !== nextId) (await resetPieceCalls(session.id));
      if (nextId) session.record.pieceProductId = nextId;
      (await saveStep(session.id, STEP, {
        status: "completed",
        input: { intent: "confirm", productId: request.productId, constraints: session.record.state.constraints },
        output: {
          products: previous?.output?.products || [],
          plans: { ...(previous?.output?.plans || {}), [facts.id]: facts.promoPlan },
          candidateIds: session.record.state.candidate_ids || [],
          confirmedFacts: facts,
          retrieveTrace: latestRetrieveTrace,
        },
        error: null,
      }));
      return { ok: true, reply: settled.reply, confirmedFacts: facts };
    }

  (await saveStep(session.id, STEP, {
    status: "running",
    input: { intent: request?.intent || "product_decision", constraints, productId: request?.productId || null },
    error: null,
  }));
  if (request?.forceFail) {
    (await saveStep(session.id, STEP, {
      status: "failed",
      input: { intent: request?.intent || "product_decision", constraints },
      keepOutput: true,
      error: "筛选没有完成，可以再试一次。",
    }));
    return { ok: false, error: "product_decision_failed" };
  }
  try {
    const probed = resolveConstraintSearch(constraints, session.record.state.constraint_roles);
    session.record.state.constraint_roles = probed.roles;
    session.record.state.candidate_ids = probed.officialIds;
    session.record.state.probe = probed.probe;
    session.record.state.applied_preference = probed.applied;
    const found = [];
    for (const id of probed.officialIds) {
      const product = productById(id);
      const read = product ? await readStore(session.id, product.name, deadlineAt) : { capped: false, hit: null };
      const explained = explainStore(read, product);
      found.push({
        id,
        name: product?.name || "",
        model: product?.model || "",
        category: product?.category || "",
        price_cny: product?.price_cny ?? null,
        source: explained.source,
        reason: explained.reason,
      });
    }
    const plans = {};
    for (const item of found) plans[item.id] = buildPromoPlan(item.id);
    const confirmedId = session.record.state.confirmed_product_id;
    const candidateIds = found.map((item) => item.id);
    session.record.state.candidate_ids = candidateIds;
    let confirmedFacts = previous?.output?.confirmedFacts || null;
    if (confirmedId && candidateIds.includes(confirmedId)) {
      confirmedFacts = await factsFor(session.id, confirmedId, plans[confirmedId], deadlineAt);
      if (!plans[confirmedId]) plans[confirmedId] = confirmedFacts.promoPlan;
    }
    const output = { products: found, plans, candidateIds, confirmedFacts, retrieveTrace: latestRetrieveTrace };
    (await saveStep(session.id, STEP, {
      status: "completed",
      input: { intent: request?.intent || "product_decision", constraints },
      output,
      error: null,
    }));
    return { ok: true, output };
  } catch (error) {
    (await saveStep(session.id, STEP, {
      status: "failed",
      input: { intent: request?.intent || "product_decision", constraints },
      keepOutput: true,
      error: "筛选没有完成，可以再试一次。",
    }));
    return { ok: false, error: error?.message || "product_decision_failed" };
  }
}
