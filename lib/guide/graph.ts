// @ts-nocheck
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { loadStep, saveStep } from "./db";
import { runContentNode } from "./content-node";
import { runProductDecision } from "./product-decision";
import { routeEdge, routeNote } from "./route";

const runs = new Map();

const State = Annotation.Root({
  runId: Annotation,
  edge: Annotation,
});

function publicRequest(request) {
  return {
    intent: request?.intent || "turn",
    needsResearch: Boolean(request?.needsResearch),
    productId: request?.productId || null,
    forceFail: Boolean(request?.forceFail),
    constraints: request?.constraints || null,
    momentsInput: request?.momentsInput || null,
  };
}

let compiled;

function guideGraph() {
  if (compiled) return compiled;
  compiled = new StateGraph(State)
    .addNode("route", async (state) => {
      const run = runs.get(state.runId);
      const edge = routeEdge({
        intent: run.request.intent,
        confirmedProductId: run.session.record.state.confirmed_product_id || null,
        pendingQuestion: run.session.record.state.pending_question || null,
        needsResearch: Boolean(run.request.needsResearch),
      });
      run.trace.edge = edge;
      run.trace.entered.push("route");
      if (edge === "blocked") run.trace.result = { ok: false, error: "need_confirm" };
      saveStep(run.session.id, "route", {
        status: "completed",
        input: publicRequest(run.request),
        output: {
          edge,
          modelCalled: false,
          runtime: "langgraph",
          note: routeNote(edge, run.request),
          entered: ["route"],
        },
        error: null,
      });
      return { edge };
    })
    .addNode("product_decision", async (state) => {
      const run = runs.get(state.runId);
      run.trace.entered.push("product_decision");
      run.trace.result = runProductDecision(run.session, run.request);
      return {};
    })
    .addNode("content", async (state) => {
      const run = runs.get(state.runId);
      run.trace.entered.push("content");
      run.trace.result = await runContentNode(run.session, run.request);
      return {};
    })
    .addEdge(START, "route")
    .addConditionalEdges("route", (state) => state.edge, {
      product_decision: "product_decision",
      content: "content",
      ask: END,
      blocked: END,
      stay: END,
    })
    .addEdge("product_decision", END)
    .addEdge("content", END)
    .compile();
  return compiled;
}

export async function runGuideGraph(session, request) {
  const runId = `${session.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const trace = { edge: null, entered: [], result: { ok: true } };
  runs.set(runId, { session, request, trace });
  try {
    await guideGraph().invoke({ runId, edge: "" });
    const row = loadStep(session.id, "route");
    saveStep(session.id, "route", {
      status: "completed",
      input: row?.input || publicRequest(request),
      output: {
        ...(row?.output || {}),
        edge: trace.edge,
        entered: trace.entered,
        modelCalled: false,
        runtime: "langgraph",
        note: routeNote(trace.edge, request),
      },
      error: null,
    });
    return {
      ok: trace.result?.ok !== false,
      edge: trace.edge,
      entered: trace.entered,
      runtime: "langgraph",
      modelCalled: false,
      error: trace.result?.error || null,
      reply: trace.result?.reply || routeNote(trace.edge, request),
      capped: Boolean(trace.result?.capped),
      failure: trace.result?.failure || null,
      output: trace.result?.output || null,
    };
  } finally {
    runs.delete(runId);
  }
}
