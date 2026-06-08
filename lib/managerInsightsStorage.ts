/**
 * 店长本店洞察：跟进状态与沉淀模板的 localStorage（仅客户端）。
 */
import { APP_LOCAL_STORAGE_KEYS } from "@/lib/appLocalStorage";
import type { FollowUpStatus, ManagerTemplateRecord } from "@/types/store-insights";

type FollowUpMap = Record<string, FollowUpStatus>;

function readFollowUpMap(): FollowUpMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(APP_LOCAL_STORAGE_KEYS.managerSummaryFollowUp);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== "object" || p === null) return {};
    return p as FollowUpMap;
  } catch {
    return {};
  }
}

function writeFollowUpMap(m: FollowUpMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_LOCAL_STORAGE_KEYS.managerSummaryFollowUp, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function getFollowUpOverride(summaryId: string): FollowUpStatus | undefined {
  return readFollowUpMap()[summaryId];
}

export function setFollowUpOverride(summaryId: string, status: FollowUpStatus): void {
  const next = { ...readFollowUpMap(), [summaryId]: status };
  writeFollowUpMap(next);
}

export function listManagerTemplates(): ManagerTemplateRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(APP_LOCAL_STORAGE_KEYS.managerTemplates);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(isTemplate);
  } catch {
    return [];
  }
}

function isTemplate(x: unknown): x is ManagerTemplateRecord {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.subject === "string" &&
    typeof o.guideName === "string" &&
    typeof o.excerpt === "string" &&
    typeof o.sourceSummaryId === "string" &&
    typeof o.createdAt === "number"
  );
}

function persistTemplates(list: ManagerTemplateRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_LOCAL_STORAGE_KEYS.managerTemplates, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export function addManagerTemplate(rec: Omit<ManagerTemplateRecord, "id" | "createdAt">): ManagerTemplateRecord {
  const item: ManagerTemplateRecord = {
    ...rec,
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const list = listManagerTemplates().filter((t) => t.sourceSummaryId !== rec.sourceSummaryId);
  list.unshift(item);
  persistTemplates(list);
  return item;
}
