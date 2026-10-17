"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssistantBubble } from "@/components/chat/AssistantBubble";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MomentsComposerBar } from "@/components/chat/moments/MomentsComposerBar";
import { MomentsInputPanel } from "@/components/chat/moments/MomentsInputPanel";
import { MomentsSetupSheet } from "@/components/chat/moments/MomentsSetupSheet";
import { RagComposerBar } from "@/components/chat/rag/RagComposerBar";
import { RagQuickAskBar } from "@/components/chat/rag/RagQuickAskBar";
import { SessionHubSheet } from "@/components/chat/SessionHubSheet";
import { SceneModeSwitch } from "@/components/chat/SceneModeSwitch";
import { PriorMemory } from "@/components/chat/guide/PriorMemory";
import { GuideProcess } from "@/components/chat/guide/GuideProcess";
import { UserBubble } from "@/components/chat/UserBubble";
import { MobileShell } from "@/components/home/MobileShell";
import { canFavoriteMessage, isFavorited, toggleFavorite } from "@/lib/favorites";
import {
  appendRagQueryHistory,
  clearRagQueryHistory,
  loadRagQueryHistory,
  removeRagQueryHistoryItem,
} from "@/lib/ragQueryHistory";
import { clearAllAppLocalStorage } from "@/lib/appLocalStorage";
import {
  agentChatRequest,
  CHAT_FAIL_MSG,
  continueGenerateCtaLabel,
  defaultMomentsInput,
  id,
  parseMomentsOutputKind,
  toAgentPayload,
} from "@/lib/chat/chatPageShared";
import { buildSessionRecord, deriveSessionTitleDual, getSession, setLastActiveSessionId, upsertSession } from "@/lib/sessions";
import { chatInitialMessages } from "@/mock/chat";
import type {
  AgentScene,
  GuideTurnBlock,
  MomentsGenerationInput,
  MomentsOutputKind,
} from "@/types/agent";
import type { ChatMessage, ContentFeedbackVote } from "@/types/chat";

export function ChatPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [sceneMode, setSceneMode] = useState<AgentScene>("store_rag_query");
  const autoSentQuery = useRef(false);
  const catalogConfirmRef = useRef(false);
  const [messagesMoments, setMessagesMoments] = useState<ChatMessage[]>(chatInitialMessages);
  const [messagesRag, setMessagesRag] = useState<ChatMessage[]>(chatInitialMessages);
  const messagesMomentsRef = useRef<ChatMessage[]>(messagesMoments);
  const messagesRagRef = useRef<ChatMessage[]>(messagesRag);
  messagesMomentsRef.current = messagesMoments;
  messagesRagRef.current = messagesRag;

  const messages = useMemo(
    () => (sceneMode === "moments_marketing" ? messagesMoments : messagesRag),
    [sceneMode, messagesMoments, messagesRag],
  );
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const [momentsForm, setMomentsForm] = useState<MomentsGenerationInput>(defaultMomentsInput);
  const [ragDraft, setRagDraft] = useState("");
  const [momentsFollowUpDraft, setMomentsFollowUpDraft] = useState("");
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragHistory, setRagHistory] = useState<string[]>([]);
  const [sessionHubOpen, setSessionHubOpen] = useState(false);
  const [momentsSetupSheetOpen, setMomentsSetupSheetOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [guideTurn, setGuideTurn] = useState<GuideTurnBlock | null>(null);
  const materialBlocked = guideTurn?.confirmedFacts
    ? null
    : "还没有确认商品。下一步：点「选择商品」，在商品列表里点一件。不必先走选品对话。";

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 2200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    setRagHistory(loadRagQueryHistory());
  }, []);

  const loadSeq = useRef(0);
  const loadGuide = useCallback(async (sid: string) => {
    if (!sid) return;
    const seq = ++loadSeq.current;
    const response = await fetch("/api/guide/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", sessionId: sid }),
    });
    const payload = await response.json();
    if (seq !== loadSeq.current) return;
    if (payload?.structured?.scene === "guide_turn") setGuideTurn(payload.structured);
  }, []);

  useEffect(() => {
    if (!sessionHydrated || !sessionId) return;
    void loadGuide(sessionId);
  }, [sessionHydrated, sessionId, sceneMode, loadGuide]);

  const confirmCatalogProduct = useCallback(async (productId: string) => {
    if (!sessionId || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/guide/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          source: "catalog",
          productId,
          sessionId,
          revision: guideTurn?.revision,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setToastMsg(payload.leadText || "没有确认成这件商品，请再点一次。");
        if (payload?.structured?.scene === "guide_turn") setGuideTurn(payload.structured);
        return;
      }
      if (payload?.structured?.scene === "guide_turn") setGuideTurn(payload.structured);
      setSceneMode("moments_marketing");
    } finally {
      setSending(false);
      void loadGuide(sessionId);
    }
  }, [sessionId, sending, guideTurn?.revision, loadGuide]);

  useEffect(() => {
    if (!sessionHydrated || !sessionId || catalogConfirmRef.current) return;
    const productId = searchParams.get("catalogProduct");
    if (!productId) return;
    catalogConfirmRef.current = true;
    setSceneMode("moments_marketing");
    void confirmCatalogProduct(productId);
  }, [sessionHydrated, sessionId, searchParams, confirmCatalogProduct]);

  useEffect(() => {
    if (sceneMode !== "moments_marketing") setMomentsSetupSheetOpen(false);
  }, [sceneMode]);

  useEffect(() => {
    if (sceneMode === "store_rag_query") setMomentsFollowUpDraft("");
  }, [sceneMode]);

  useEffect(() => {
    if (searchParams.get("clearLocal") === "1") {
      clearAllAppLocalStorage();
      const sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      router.replace(`/chat?sessionId=${encodeURIComponent(sid)}`, { scroll: false });
      setSessionId(sid);
      setMessagesMoments(chatInitialMessages);
      setMessagesRag(chatInitialMessages);
      setSceneMode("moments_marketing");
      setMomentsForm(defaultMomentsInput);
      setRagHistory([]);
      setRagDraft("");
      setMomentsFollowUpDraft("");
      setRagFile(null);
      setSessionHubOpen(false);
      setMomentsSetupSheetOpen(false);
      setSessionHydrated(true);
      return;
    }

    const kindParam = parseMomentsOutputKind(searchParams.get("outputKind"));
    const sceneParam = searchParams.get("scene");

    const param = searchParams.get("sessionId");
    let sid = param?.trim() ?? "";
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const next = new URLSearchParams(searchParams.toString());
      next.set("sessionId", sid);
      router.replace(`/chat?${next.toString()}`, { scroll: false });
    }
    const sameSession = sessionId === sid && messagesRagRef.current.length > 0;
    setSessionId(sid);
    const rec = sameSession ? null : getSession(sid);
    if (sameSession) {
      if (sceneParam === "moments_marketing" || sceneParam === "store_rag_query") setSceneMode(sceneParam);
      setSessionHydrated(true);
      return;
    }
    if (rec) {
      setMessagesMoments(rec.messagesMoments?.length ? rec.messagesMoments : chatInitialMessages);
      setMessagesRag(rec.messagesRag?.length ? rec.messagesRag : chatInitialMessages);
      setSceneMode(rec.sceneMode);
      if (rec.momentsForm) {
        setMomentsForm({
          ...defaultMomentsInput,
          ...rec.momentsForm,
          sellingPoints: [...(rec.momentsForm.sellingPoints ?? [])],
        });
      } else {
        setMomentsForm(defaultMomentsInput);
      }
    } else {
      setMessagesMoments(chatInitialMessages);
      setMessagesRag(chatInitialMessages);
      setSceneMode("store_rag_query");
      setMomentsForm(defaultMomentsInput);
    }

    if (sceneParam === "moments_marketing" || sceneParam === "store_rag_query") {
      setSceneMode(sceneParam);
    }
    if (kindParam) {
      setMomentsForm((prev) => ({ ...prev, outputKind: kindParam }));
    }

    setSessionHydrated(true);
  }, [router, searchParams]);

  useEffect(() => {
    if (!sessionHydrated || !sessionId) return;
    setLastActiveSessionId(sessionId);
  }, [sessionHydrated, sessionId]);

  useEffect(() => {
    if (!sessionHydrated || !sessionId) return;
    const handle = window.setTimeout(() => {
      const moments = messagesMomentsRef.current;
      const rag = messagesRagRef.current;
      upsertSession(
        buildSessionRecord(sessionId, moments, rag, sceneMode, {
          ...momentsForm,
          sellingPoints: [...momentsForm.sellingPoints],
        }),
      );
      void fetch("/api/guide/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync",
          sessionId,
          transcript: {
            title: deriveSessionTitleDual(moments, rag),
            sceneMode,
            messagesMoments: moments,
            messagesRag: rag,
            momentsForm,
          },
        }),
      });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [sessionHydrated, sessionId, messagesMoments, messagesRag, sceneMode, momentsForm]);

  const hasMomentsAssistantCard = useMemo(
    () =>
      messages.some((m) => m.role === "assistant" && m.structured?.scene === "moments_marketing"),
    [messages],
  );

  const lastMomentsAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.structured?.scene === "moments_marketing") return m.id;
    }
    return null;
  }, [messages]);

  const continueGenerateLabel = useMemo(
    () => continueGenerateCtaLabel(momentsForm.outputKind),
    [momentsForm.outputKind],
  );

  const onToggleFavorite = useCallback(
    (message: ChatMessage) => {
      if (!sessionId) return;
      const sessionTitle = deriveSessionTitleDual(messagesMomentsRef.current, messagesRagRef.current);
      const r = toggleFavorite({ sessionId, sessionTitle, message });
      if (r === "added") setToastMsg("已加入收藏");
      else if (r === "removed") setToastMsg("已取消收藏");
    },
    [sessionId],
  );

  const handleContinueMomentsSetup = useCallback(() => {
    const assistantId = lastMomentsAssistantId;
    if (!assistantId || sending) return;
    const prev = messagesMomentsRef.current;
    const idx = prev.findIndex((m) => m.id === assistantId);
    if (idx < 1) return;
    const userMsg = prev[idx - 1];
    const assistant = prev[idx];
    if (userMsg.role !== "user" || assistant.role !== "assistant" || !assistant.structured) return;
    if (assistant.structured.scene !== "moments_marketing") return;

    const snap =
      userMsg.momentsSnapshot ?? {
        ...momentsForm,
        sellingPoints: [...momentsForm.sellingPoints],
      };
    const editorMsg: ChatMessage = {
      id: id("minline"),
      role: "user",
      text: "",
      momentsInlineEditor: true,
      momentsSnapshot: {
        ...defaultMomentsInput,
        ...snap,
        sellingPoints: [...(snap.sellingPoints ?? [])],
      },
    };
    setMessagesMoments((p) => {
      const cleaned = p.filter((m) => !m.momentsInlineEditor);
      const i = cleaned.findIndex((m) => m.id === assistantId);
      if (i < 0) return p;
      return [...cleaned.slice(0, i + 1), editorMsg, ...cleaned.slice(i + 1)];
    });
    setMomentsForm(editorMsg.momentsSnapshot!);
  }, [lastMomentsAssistantId, sending, momentsForm]);

  const generateMoments = useCallback(async () => {
    if (!guideTurn?.confirmedFacts || sending) return;
    const snap: MomentsGenerationInput = {
      ...momentsForm,
      productName: guideTurn.confirmedFacts.name,
      sellingPoints: [...momentsForm.sellingPoints],
    };

    setMomentsSetupSheetOpen(false);

    const userMsg: ChatMessage = {
      id: id("u"),
      role: "user",
      text: "",
      momentsSnapshot: snap,
    };

    const afterUser = [...messagesMomentsRef.current, userMsg];
    setMessagesMoments(afterUser);
    setSending(true);

    try {
      const payload = await agentChatRequest({
        scene: "moments_marketing",
        messages: afterUser.map(toAgentPayload),
        sessionId,
        momentsInput: snap,
      });
      setMessagesMoments((p) => [
        ...p,
        {
          id: payload.messageId || id("a"),
          role: "assistant",
          leadText: payload.leadText,
          structured: payload.structured,
        },
      ]);
    } catch {
      setMessagesMoments((p) => [
        ...p,
        {
          id: id("a"),
          role: "assistant",
          leadText: CHAT_FAIL_MSG,
        },
      ]);
    } finally {
      setSending(false);
      if (sessionId) void loadGuide(sessionId);
    }
  }, [momentsForm, sending, sessionId, guideTurn, loadGuide]);

  const sendMomentsFollowUp = useCallback(async () => {
    const text = momentsFollowUpDraft.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: id("u"),
      role: "user",
      text,
    };

    setMomentsFollowUpDraft("");
    setMessagesMoments((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const payload = await agentChatRequest({
        scene: "store_rag_query",
        messages: [{ role: "user", content: text }],
        sessionId,
      });
      if (payload?.structured?.scene === "guide_turn") setGuideTurn(payload.structured);
      setMessagesMoments((prev) => [
        ...prev,
        {
          id: payload.messageId || id("a"),
          role: "assistant",
          leadText: payload.leadText,
        },
      ]);
      if (payload?.structured?.scene === "guide_turn") {
        setMessagesRag((prev) => {
          const next = {
            id: payload.messageId || id("a"),
            role: "assistant" as const,
            leadText: payload.leadText,
            structured: payload.structured,
          };
          let index = -1;
          for (let i = prev.length - 1; i >= 0; i -= 1) {
            if (prev[i].role === "assistant" && prev[i].structured?.scene === "guide_turn") {
              index = i;
              break;
            }
          }
          if (index < 0) return [...prev, userMsg, next];
          return [...prev.slice(0, index), userMsg, next, ...prev.slice(index + 1)];
        });
      }
    } catch {
      setMessagesMoments((p) => [
        ...p,
        {
          id: id("a"),
          role: "assistant",
          leadText: CHAT_FAIL_MSG,
        },
      ]);
    } finally {
      setSending(false);
      if (sessionId) void loadGuide(sessionId);
    }
  }, [momentsFollowUpDraft, sending, sessionId, loadGuide]);

  const sendRagText = useCallback(async (text: string, file: File | null) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: id("u"),
      role: "user",
      text: [trimmed, file ? `【已选凭证】${file.name}` : ""].filter(Boolean).join("\n"),
      ragQuery: trimmed,
      ragAttachmentNote: file?.name,
    };

    setRagDraft("");
    setRagFile(null);

    const afterUser = [...messagesRagRef.current, userMsg];
    setMessagesRag(afterUser);
    setSending(true);

    try {
      const payload = await agentChatRequest({
        scene: "store_rag_query",
        messages: afterUser.map(toAgentPayload),
        attachmentNote: file?.name,
        sessionId,
      });
      setMessagesRag((p) => [
        ...p,
        {
          id: payload.messageId || id("a"),
          role: "assistant",
          leadText: payload.leadText,
          structured: payload.structured,
        },
      ]);
      setRagHistory(appendRagQueryHistory(trimmed));
    } catch {
      setMessagesRag((p) => [
        ...p,
        {
          id: id("a"),
          role: "assistant",
          leadText: CHAT_FAIL_MSG,
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [sending, sessionId]);

  const sendRag = useCallback(() => {
    void sendRagText(ragDraft, ragFile);
  }, [sendRagText, ragDraft, ragFile]);

  const onRagPreset = useCallback((q: string) => {
    void sendRagText(q, null);
  }, [sendRagText]);

  const onRagHistoryPick = useCallback((q: string) => {
    setRagDraft(q);
  }, []);

  const onRagHistoryRemove = useCallback((q: string) => {
    setRagHistory(removeRagQueryHistoryItem(q));
  }, []);

  const onRagHistoryClear = useCallback(() => {
    setRagHistory(clearRagQueryHistory());
  }, []);

  const updateInlineMoments = useCallback((editorId: string, next: MomentsGenerationInput) => {
    setMessagesMoments((prev) =>
      prev.map((msg) =>
        msg.id === editorId && msg.momentsInlineEditor
          ? { ...msg, momentsSnapshot: { ...next, sellingPoints: [...next.sellingPoints] } }
          : msg,
      ),
    );
  }, []);

  const generateFromInlineMoments = useCallback(
    async (editorId: string) => {
      const list = messagesMomentsRef.current;
      const ed = list.find((m) => m.id === editorId);
      if (!guideTurn?.confirmedFacts || sending) return;
      const snap = {
        ...ed?.momentsSnapshot,
        outputKind: ed?.momentsSnapshot?.outputKind || momentsForm.outputKind,
        productName: guideTurn.confirmedFacts.name,
        sellingPoints: [...(ed?.momentsSnapshot?.sellingPoints ?? momentsForm.sellingPoints)],
        copyStyle: ed?.momentsSnapshot?.copyStyle || momentsForm.copyStyle,
        audience: ed?.momentsSnapshot?.audience || momentsForm.audience,
      };

      setMomentsSetupSheetOpen(false);

      const userMsg: ChatMessage = {
        id: id("u"),
        role: "user",
        text: "",
        momentsSnapshot: { ...snap, sellingPoints: [...snap.sellingPoints] },
      };

      const withoutEditor = list.filter((m) => m.id !== editorId);
      const afterUser = [...withoutEditor, userMsg];
      setMessagesMoments(afterUser);
      setMomentsForm({ ...snap, sellingPoints: [...snap.sellingPoints] });
      setSending(true);

      try {
        const payload = await agentChatRequest({
          scene: "moments_marketing",
          messages: afterUser.map(toAgentPayload),
          sessionId,
          momentsInput: snap,
        });
        setMessagesMoments((p) => [
          ...p,
          {
            id: payload.messageId || id("a"),
            role: "assistant",
            leadText: payload.leadText,
            structured: payload.structured,
          },
        ]);
      } catch {
        setMessagesMoments((p) => [
          ...p,
          {
            id: id("a"),
            role: "assistant",
            leadText: CHAT_FAIL_MSG,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sending, guideTurn, momentsForm, sessionId],
  );

  const setAssistantFeedback = useCallback((messageId: string, vote: ContentFeedbackVote | null) => {
    const mapU = (prev: ChatMessage[]) =>
      prev.map((msg) =>
        msg.id === messageId && msg.role === "assistant" ? { ...msg, contentFeedback: vote } : msg,
      );
    setMessagesMoments(mapU);
    setMessagesRag(mapU);
  }, []);

  const regenerateForAssistant = useCallback(
    async (assistantId: string) => {
      if (sending) return;
      const prev = messagesRef.current;
      const idx = prev.findIndex((m) => m.id === assistantId);
      if (idx < 1) return;
      const userMsg = prev[idx - 1];
      const assistant = prev[idx];
      if (userMsg.role !== "user" || assistant.role !== "assistant" || !assistant.structured) return;

      const scene =
        assistant.structured.scene === "moments_marketing" ? "moments_marketing" : "store_rag_query";

      if (scene === "moments_marketing") {
        const snap = {
          ...(userMsg.momentsSnapshot ?? momentsForm),
          productName: guideTurn?.confirmedFacts?.name || userMsg.momentsSnapshot?.productName || momentsForm.productName,
          sellingPoints: [...(userMsg.momentsSnapshot?.sellingPoints ?? momentsForm.sellingPoints)],
        };
        if (!guideTurn?.confirmedFacts) return;

        const prefix = prev.slice(0, idx);
        const loadingId = id("regen");
        setSending(true);
        setMessagesMoments((p) => {
          const i = p.findIndex((m) => m.id === assistantId);
          if (i < 0) return p;
          return [...p.slice(0, i), { id: loadingId, role: "assistant", leadText: "重新生成中…" }];
        });

        try {
          const payload = await agentChatRequest({
            scene: "moments_marketing",
            messages: prefix.map(toAgentPayload),
            sessionId,
            momentsInput: snap,
          });
          setMessagesMoments((p) => {
            const i = p.findIndex((m) => m.id === loadingId);
            if (i < 0) return p;
            return [
              ...p.slice(0, i),
              {
                id: payload.messageId || id("a"),
                role: "assistant",
                leadText: payload.leadText,
                structured: payload.structured,
              },
            ];
          });
        } catch {
          setMessagesMoments((p) => {
            const i = p.findIndex((m) => m.id === loadingId);
            if (i < 0) return p;
            return [
              ...p.slice(0, i),
              {
                id: id("a"),
                role: "assistant",
                leadText: CHAT_FAIL_MSG,
              },
            ];
          });
        } finally {
          setSending(false);
        }
        return;
      }

      const prefix = prev.slice(0, idx);
      const loadingId = id("regen");
      setSending(true);
      setMessagesRag((p) => {
        const i = p.findIndex((m) => m.id === assistantId);
        if (i < 0) return p;
        return [...p.slice(0, i), { id: loadingId, role: "assistant", leadText: "重新生成中…" }];
      });

      try {
        const payload = await agentChatRequest({
          scene,
          messages: prefix.map(toAgentPayload),
          attachmentNote: userMsg.ragAttachmentNote,
        });
        setMessagesRag((p) => {
          const i = p.findIndex((m) => m.id === loadingId);
          if (i < 0) return p;
          return [
            ...p.slice(0, i),
            {
              id: payload.messageId || id("a"),
              role: "assistant",
              leadText: payload.leadText,
              structured: payload.structured,
            },
          ];
        });
      } catch {
        setMessagesRag((p) => {
          const i = p.findIndex((m) => m.id === loadingId);
          if (i < 0) return p;
          return [
            ...p.slice(0, i),
            {
              id: id("a"),
              role: "assistant",
              leadText: CHAT_FAIL_MSG,
            },
          ];
        });
      } finally {
        setSending(false);
      }
    },
    [momentsForm, sending, sessionId, guideTurn],
  );

  const runGuideAction = useCallback(async (body: Record<string, unknown>) => {
    if (body.action === "favorite") {
      const message = [...messagesRagRef.current].reverse().find((item) => item.role === "assistant" && item.structured?.scene === "guide_turn" && item.structured.confirmedName);
      if (message && sessionId) {
        const result = toggleFavorite({
          sessionId,
          sessionTitle: deriveSessionTitleDual(messagesMomentsRef.current, messagesRagRef.current),
          message,
        });
        setToastMsg(result === "added" ? "已收藏这件商品" : result === "removed" ? "已取消收藏" : "还不能收藏");
      }
      return;
    }
    if (body.action === "open-material") {
      const productName = String(body.productName || "");
      if (productName) {
        setMomentsForm((prev) => ({ ...prev, productName, outputKind: prev.outputKind || "rich" }));
      }
      setSceneMode("moments_marketing");
      return;
    }
    if (sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/guide/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, sessionId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setToastMsg(payload.leadText || (payload.error === "revision_conflict" ? "页面已更新，请再试一次。" : "没有完成，请再试一次。"));
        if (payload?.structured?.scene === "guide_turn") setGuideTurn(payload.structured);
        return;
      }
      const action = String(body.action || "");
      const userText = action === "confirm"
        ? `确认了${payload.structured?.confirmedName || "这件商品"}`
        : action === "remember"
          ? (body.key === "已确认商品" ? "记住已确认商品" : "记住这次约束")
          : "";
      setMessagesRag((prev) => {
        const user = userText ? [{ id: id("u"), role: "user" as const, text: userText }] : [];
        const next = {
          id: payload.messageId || id("a"),
          role: "assistant" as const,
          leadText: payload.leadText,
          structured: payload.structured,
        };
        let index = -1;
        for (let i = prev.length - 1; i >= 0; i -= 1) {
          const item = prev[i];
          if (item.role === "assistant" && item.structured?.scene === "guide_turn") {
            index = i;
            break;
          }
        }
        if (index < 0) return [...prev, ...user, next];
        return [...prev.slice(0, index), ...user, next, ...prev.slice(index + 1)];
      });
    } finally {
      setSending(false);
      if (sessionId) void loadGuide(sessionId);
    }
  }, [sessionId, sending, loadGuide]);

  useEffect(() => {
    if (!sessionHydrated || autoSentQuery.current) return;
    const query = searchParams.get("q");
    if (!query) return;
    autoSentQuery.current = true;
    setSceneMode("store_rag_query");
    setRagDraft("");
    const userMsg: ChatMessage = { id: id("u"), role: "user", text: query, ragQuery: query };
    const afterUser = [...messagesRagRef.current, userMsg];
    setMessagesRag(afterUser);
    setSending(true);
    void agentChatRequest({
      scene: "store_rag_query",
      messages: afterUser.map(toAgentPayload),
      sessionId,
    }).then((payload) => {
      setMessagesRag((prev) => [...prev, {
        id: payload.messageId || id("a"),
        role: "assistant",
        leadText: payload.leadText,
        structured: payload.structured,
      }]);
    }).catch(() => {
      setMessagesRag((prev) => [...prev, { id: id("a"), role: "assistant", leadText: CHAT_FAIL_MSG }]);
    }).finally(() => setSending(false));
  }, [sessionHydrated, searchParams, sessionId]);

  return (
    <MobileShell
      footer={
        sceneMode === "store_rag_query" ? (
          <div className="border-t border-slate-200/50 bg-white/95 shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.06)]">
            <RagQuickAskBar onPickPreset={onRagPreset} />
            <RagComposerBar
              value={ragDraft}
              onChange={setRagDraft}
              onSend={sendRag}
              fileName={ragFile?.name}
              onFileChange={setRagFile}
              disabled={sending}
              sending={sending}
            />
          </div>
        ) : (
          <div className="border-t border-slate-200/50 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.06)]">
            <MomentsComposerBar
              value={momentsFollowUpDraft}
              onChange={setMomentsFollowUpDraft}
              onSend={() => void sendMomentsFollowUp()}
              disabled={sending}
              sending={sending}
            />
          </div>
        )
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {toastMsg ? (
            <div
              className="pointer-events-none fixed left-1/2 top-[max(5.5rem,env(safe-area-inset-top,0px)+4rem)] z-[300] -translate-x-1/2 rounded-full bg-slate-900/88 px-4 py-2 text-[0.78rem] font-medium text-white shadow-lg"
              role="status"
            >
              {toastMsg}
            </div>
          ) : null}
          <ChatHeader
            onOpenSessionHub={() => {
              setMomentsSetupSheetOpen(false);
              setSessionHubOpen(true);
            }}
          />
          <SceneModeSwitch value={sceneMode} onChange={setSceneMode} />
          {sessionHydrated && sceneMode === "store_rag_query" ? <PriorMemory sessionId={sessionId} revision={messagesRag.length} /> : null}
          <div
            className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-0 pb-4 pt-2 tech-scroll [scrollbar-gutter:stable_both-edges]"
            aria-busy={sending}
          >
            {sessionHydrated && sceneMode === "moments_marketing" && guideTurn?.material?.pendingReview ? (
              <p className="mx-3 mb-2 rounded-xl bg-orange-50 px-3 py-3 text-[0.84rem] font-semibold leading-relaxed text-orange-900">
                待核对。{guideTurn.material.reviewNote || "上一套文案和配图还不能直接用。下一步：点重新生成素材。"}
              </p>
            ) : null}
            {sessionHydrated && sceneMode === "moments_marketing" && !momentsSetupSheetOpen ? (
              <div className="shrink-0 px-0">
                <MomentsInputPanel
                  variant="inline"
                  loading={sending}
                  value={momentsForm}
                  facts={guideTurn?.confirmedFacts || null}
                  blockedMessage={materialBlocked}
                  catalog={guideTurn?.catalog || []}
                  onPickProduct={(productId) => void confirmCatalogProduct(productId)}
                  onChange={setMomentsForm}
                  onGenerate={generateMoments}
                  generateDisabled={sending || !guideTurn?.confirmedFacts}
                />
              </div>
            ) : null}
            {!sessionHydrated ? (
              <p className="py-12 text-center text-[0.85rem] font-medium text-slate-500">加载会话…</p>
            ) : messages.length === 0 ? null : (
              messages.map((m) => {
                if (m.role === "user" && m.momentsInlineEditor && m.momentsSnapshot) {
                  return (
                    <div key={m.id} className="px-0 pt-2">
                      <MomentsInputPanel
                        variant="inline"
                        loading={sending}
                        value={m.momentsSnapshot}
                        facts={guideTurn?.confirmedFacts || null}
                        blockedMessage={materialBlocked}
                        catalog={guideTurn?.catalog || []}
                        onPickProduct={(productId) => void confirmCatalogProduct(productId)}
                        onChange={(next) => updateInlineMoments(m.id, next)}
                        onGenerate={() => void generateFromInlineMoments(m.id)}
                        generateDisabled={sending || !guideTurn?.confirmedFacts}
                      />
                    </div>
                  );
                }
                if (m.role === "user") {
                  if (m.momentsSnapshot && !m.text?.trim()) return null;
                  return <UserBubble key={m.id} text={m.text ?? ""} />;
                }
                return (
                  <AssistantBubble
                    key={m.id}
                    favorited={isFavorited(m.id)}
                    showFavorite={canFavoriteMessage(m)}
                    onToggleFavorite={() => onToggleFavorite(m)}
                    leadText={m.leadText}
                    structured={m.structured}
                    contentFeedback={m.contentFeedback}
                    onContentFeedback={
                      m.structured ? (vote) => setAssistantFeedback(m.id, vote) : undefined
                    }
                    onRegenerate={m.structured ? () => void regenerateForAssistant(m.id) : undefined}
                    actionsDisabled={sending}
                    showContinueGenerate={
                      Boolean(
                        lastMomentsAssistantId &&
                          m.id === lastMomentsAssistantId &&
                          hasMomentsAssistantCard &&
                          sceneMode === "moments_marketing",
                      )
                    }
                    onContinueGenerate={handleContinueMomentsSetup}
                    continueGenerateLabel={continueGenerateLabel}
                    onMomentsDownloadHint={(msg) => setToastMsg(msg)}
                    onGuideAction={(body) => void runGuideAction(body)}
                  />
                );
              })
            )}
            {sessionHydrated && sceneMode === "moments_marketing" && (guideTurn?.process || guideTurn?.reflection?.checks?.length) ? (
              <div className="px-3 pt-2">
                <GuideProcess process={guideTurn.process} reflection={guideTurn.reflection} />
              </div>
            ) : null}
          </div>
        </div>
        <SessionHubSheet
          open={sessionHubOpen}
          onClose={() => setSessionHubOpen(false)}
          ragQueryHistory={ragHistory}
          onPickRagQuery={onRagHistoryPick}
          onRemoveRagQuery={onRagHistoryRemove}
          onClearRagQuery={onRagHistoryClear}
        />
        <MomentsSetupSheet
          open={sceneMode === "moments_marketing" && momentsSetupSheetOpen}
          onClose={() => setMomentsSetupSheetOpen(false)}
        >
          <MomentsInputPanel
            variant="sheet"
            loading={sending}
            value={momentsForm}
            facts={guideTurn?.confirmedFacts || null}
            blockedMessage={materialBlocked}
            catalog={guideTurn?.catalog || []}
            onPickProduct={(productId) => void confirmCatalogProduct(productId)}
            onChange={setMomentsForm}
            onGenerate={generateMoments}
            generateDisabled={sending || !guideTurn?.confirmedFacts}
          />
        </MomentsSetupSheet>
      </div>
    </MobileShell>
  );
}
