import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    const base = path.resolve(path.dirname(parent), specifier);
    for (const ext of [".ts", ".tsx", ".mjs", ".js", ".json"]) {
      if (!existsSync(base + ext)) continue;
      return nextResolve(specifier + ext, context);
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    return {
      format: "json",
      source: readFileSync(fileURLToPath(url), "utf8"),
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
