// @ts-nocheck
import catalog from "../../data/catalog.json";

const COLORS = [...new Set(catalog.map((item) => item.color))];
const MATERIALS = [...new Set(catalog.map((item) => item.material))];
const STYLES = [...new Set(catalog.map((item) => item.style).filter(Boolean))];
const HARD_MARK = /必须|一定要|只能|只要/;
const PREFER_MARK = /最好|优先|尽量|喜欢|偏好|可以的话/;

export function markerStrength(span) {
  const text = String(span || "");
  if (HARD_MARK.test(text)) return { strength: "hard", locked: true };
  if (PREFER_MARK.test(text)) return { strength: "prefer", locked: false };
  return { strength: "hard", locked: false };
}

export function normalizeInterpretation(raw) {
  const clauses = Array.isArray(raw?.clauses) ? raw.clauses : [];
  const unresolved = Array.isArray(raw?.unresolved) ? raw.unresolved : [];
  return {
    clauses: clauses.map((clause) => ({
      attribute: String(clause?.attribute || ""),
      value: String(clause?.value ?? "").trim(),
      polarity: clause?.polarity === "exclude" || clause?.include === false ? "exclude" : "include",
      span: String(clause?.span || clause?.source_span || clause?.sourceSpan || ""),
    })),
    unresolved: unresolved.map((item) => String(item || "").trim()).filter(Boolean),
  };
}

function canonicalColor(value) {
  if (value === "浅色") return "浅色";
  if ((value === "原木" || value === "原木色") && COLORS.includes("原木色")) return "原木色";
  return COLORS.includes(value) ? value : null;
}

function mentioned(text, raw, canonical) {
  if (raw && text.includes(raw)) return true;
  if (canonical && text.includes(canonical)) return true;
  if (canonical === "原木色" && text.includes("原木")) return true;
  return false;
}

function scopeFor(utterance, value, span) {
  const text = String(utterance || "");
  const parts = text.split(/[、，,。；;\n]/).map((item) => item.trim()).filter(Boolean);
  const needle = String(value || "");
  const part = parts.find((item) => needle && item.includes(needle))
    || parts.find((item) => needle === "原木色" && item.includes("原木"))
    || "";
  const given = String(span || "");
  if (given && text.includes(given)) {
    if (HARD_MARK.test(given) && PREFER_MARK.test(given) && part) return part;
    return given;
  }
  return part;
}

function pushUnique(list, value) {
  const text = String(value || "").trim();
  if (text && !list.includes(text)) list.push(text);
}

export function clausePatch(text, interpretation) {
  if (!interpretation) return null;
  const normalized = normalizeInterpretation(interpretation);
  const utterance = String(text || "");
  const unresolved = [];
  const marks = {};
  let color = null;
  let style = null;
  let materialInclude = null;
  const excludes = [];
  let accepted = false;
  for (const clause of normalized.clauses) {
    const attribute = clause.attribute;
    const raw = clause.value;
    if (attribute === "budget" || attribute === "width" || attribute === "category") continue;
    if (!["color", "material", "style"].includes(attribute)) {
      if (raw && utterance.includes(raw)) pushUnique(unresolved, raw);
      continue;
    }
    const scope = scopeFor(utterance, raw, clause.span);
    if (attribute === "color") {
      const value = canonicalColor(raw);
      if (!value || !mentioned(utterance, raw, value)) {
        pushUnique(unresolved, raw);
        continue;
      }
      if (clause.polarity === "exclude") {
        pushUnique(unresolved, raw);
        continue;
      }
      color = { value };
      marks.color = markerStrength(scope);
      accepted = true;
      continue;
    }
    if (attribute === "style") {
      if (!STYLES.includes(raw) || !utterance.includes(raw)) {
        pushUnique(unresolved, raw);
        continue;
      }
      if (clause.polarity === "exclude") {
        pushUnique(unresolved, raw);
        continue;
      }
      style = raw;
      marks.style = markerStrength(scope);
      accepted = true;
      continue;
    }
    if (!MATERIALS.includes(raw) || !utterance.includes(raw)) {
      pushUnique(unresolved, raw);
      continue;
    }
    if (clause.polarity === "exclude") {
      if (!excludes.includes(raw)) excludes.push(raw);
      accepted = true;
      continue;
    }
    materialInclude = raw;
    marks.material = markerStrength(scope);
    accepted = true;
  }
  for (const phrase of normalized.unresolved) {
    if (utterance.includes(phrase)) pushUnique(unresolved, phrase);
  }
  let material = null;
  if (excludes.length > 1) material = { ambiguous: excludes };
  else if (excludes.length === 1) material = { value: excludes[0] };
  if (materialInclude) material = { ...(material || {}), include: materialInclude };
  const consumed = [color?.value, color?.value === "原木色" ? "原木" : "", style, materialInclude, ...excludes].filter(Boolean);
  const pending = unresolved.filter((phrase) => !consumed.some((item) => phrase === item));
  return {
    color,
    style,
    material,
    marks,
    unresolved: pending,
    active: accepted || pending.length > 0,
  };
}
