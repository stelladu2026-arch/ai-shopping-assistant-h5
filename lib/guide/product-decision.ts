// @ts-nocheck
import promotions from "../../data/promotions.json";
import { confirmFromCatalog, confirmProduct, productById, resolveConstraintSearch } from "./engine";
import { retrieve } from "./knowledge";
import { buildPromoPlan } from "./promos";
import { consumeCall, loadStep, saveStep } from "./db";
import { LIMITS, capText } from "./limits";

const STEP = "product_decision";

export function lookupStoreDoc(query) {
  const hit = retrieve(query);
  return {
    ok: true,
    found: Boolean(hit),
    source: hit?.source || null,
    text: hit ? `门店资料《${hit.title}》：${hit.excerpt}` : "没有检索到门店资料，不能编造说明。",
  };
}

function readStore(sessionId, query) {
  const gate = consumeCall(sessionId, "retrieve", LIMITS.retrieve);
  if (!gate.ok) return { capped: true, hit: null };
  return { capped: false, hit: retrieve(query) };
}

function factsFor(sessionId, productId, plan) {
  const product = productById(productId);
  if (!product) return null;
  const read = readStore(sessionId, product.name);
  const hit = read.hit;
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
    sourceTitle: hit?.title || null,
    sourceExcerpt: hit?.excerpt || null,
    sourceFile: hit?.source || null,
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

export function runProductDecision(session, request) {
  const gate = consumeCall(session.id, "product_decision", LIMITS.product_decision);
  if (!gate.ok) {
    return { ok: true, capped: true, reply: capText("product_decision") };
  }
  const previous = loadStep(session.id, STEP);
  const constraints = request?.constraints || session.record.state.constraints;
  if (request?.intent === "confirm") {
    const previousId = session.record.state.confirmed_product_id;
    const settled = request.source === "catalog"
      ? confirmFromCatalog(session.record.state, request.productId, request.revision)
      : confirmProduct(session.record.state, request.productId, request.revision);
    if (!settled.ok) return { ok: false, error: settled.error || "confirm_failed" };
      session.record.state = settled.state;
      const facts = factsFor(session.id, settled.state.confirmed_product_id, previous?.output?.plans?.[settled.state.confirmed_product_id]);
      if (session.record.state.card && facts?.promoPlan) {
        session.record.state.card.promotions = chosenPromotions(facts.promoPlan);
      }
      if (session.record.material?.bodyText && previousId && previousId !== facts?.id) {
        markPending(session, "确认的商品已更换，上一套文案和配图待核对。下一步：点重新生成素材。");
      }
      saveStep(session.id, STEP, {
        status: "completed",
        input: { intent: "confirm", productId: request.productId, constraints: session.record.state.constraints },
        output: {
          products: previous?.output?.products || [],
          plans: { ...(previous?.output?.plans || {}), [facts.id]: facts.promoPlan },
          candidateIds: session.record.state.candidate_ids || [],
          confirmedFacts: facts,
        },
        error: null,
      });
      return { ok: true, reply: settled.reply, confirmedFacts: facts };
    }

  saveStep(session.id, STEP, {
    status: "running",
    input: { intent: request?.intent || "product_decision", constraints, productId: request?.productId || null },
    error: null,
  });
  if (request?.forceFail) {
    saveStep(session.id, STEP, {
      status: "failed",
      input: { intent: request?.intent || "product_decision", constraints },
      keepOutput: true,
      error: "筛选没有完成，可以再试一次。",
    });
    return { ok: false, error: "product_decision_failed" };
  }
  try {
    const probed = resolveConstraintSearch(constraints, session.record.state.constraint_roles);
    session.record.state.constraint_roles = probed.roles;
    session.record.state.candidate_ids = probed.officialIds;
    session.record.state.probe = probed.probe;
    session.record.state.applied_preference = probed.applied;
    const found = probed.officialIds.map((id) => {
      const product = productById(id);
      const read = product ? readStore(session.id, product.name) : { capped: false, hit: null };
      const hit = read.hit;
      return {
        id,
        name: product?.name || "",
        model: product?.model || "",
        category: product?.category || "",
        price_cny: product?.price_cny ?? null,
        source: hit?.source || null,
        reason: read.capped
          ? capText("retrieve")
          : hit
            ? `门店资料《${hit.title}》：${hit.excerpt}`
            : "没有检索到这件商品的门店资料，不能编造说明。",
      };
    });
    const plans = {};
    for (const item of found) plans[item.id] = buildPromoPlan(item.id);
    const confirmedId = session.record.state.confirmed_product_id;
    const candidateIds = found.map((item) => item.id);
    session.record.state.candidate_ids = candidateIds;
    let confirmedFacts = previous?.output?.confirmedFacts || null;
    if (confirmedId && candidateIds.includes(confirmedId)) {
      confirmedFacts = factsFor(session.id, confirmedId, plans[confirmedId]);
      if (!plans[confirmedId]) plans[confirmedId] = confirmedFacts.promoPlan;
    }
    const output = { products: found, plans, candidateIds, confirmedFacts };
    saveStep(session.id, STEP, {
      status: "completed",
      input: { intent: request?.intent || "product_decision", constraints },
      output,
      error: null,
    });
    return { ok: true, output };
  } catch (error) {
    saveStep(session.id, STEP, {
      status: "failed",
      input: { intent: request?.intent || "product_decision", constraints },
      keepOutput: true,
      error: "筛选没有完成，可以再试一次。",
    });
    return { ok: false, error: error?.message || "product_decision_failed" };
  }
}
