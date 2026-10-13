// @ts-nocheck
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data", "knowledge");

export function retrieve(query) {
  const needle = String(query || "").trim();
  if (!needle || !fs.existsSync(dir)) return null;
  const hits = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    if (!raw.includes(needle)) continue;
    const title = (raw.match(/^#\s+(.+)$/m) || [, file.replace(/\.md$/, "")])[1];
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    const excerpt = (lines.find((line) => line.includes(needle)) || lines[0] || "").slice(0, 180);
    hits.push({ title, source: file, excerpt });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.source.length - b.source.length);
  return hits[0];
}
