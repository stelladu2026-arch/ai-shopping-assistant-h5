import "./register-ts.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executeImage as executeGuide } from "../lib/guide/image.ts";
import { executeImage as executeServer } from "../server/image.mjs";

const product = { id: "S01", name: "云朵双人沙发", color: "米白", material: "布艺", model: "YD-180" };
const ready = {
  IMAGE_API_BASE: "http://image.test.local",
  IMAGE_MODEL: "image-fixture",
  IMAGE_API_KEY: "image-test",
  GUIDE_IMAGE_ENABLED: "true",
};
const imageUrl = "https://img.example.test/sofa.png";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function jsonResponse(status, payload) {
  const body = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

async function check(executeImage) {
  let missingCalls = 0;
  const missing = await executeImage(product, {}, async () => {
    missingCalls += 1;
    throw new Error("should not request");
  });
  assert.equal(missingCalls, 0);
  assert.equal(missing.called, false);
  assert.equal(missing.simulation, true);
  assert.equal(missing.url, "");
  assert.equal(missing.label, "没有调用生图接口");

  const shown = await executeImage(product, ready, async (url, init) => {
    assert.equal(String(url), "http://image.test.local/images/generations");
    assert.equal(init.headers.Authorization, "Bearer image-test");
    return jsonResponse(200, { data: [{ url: imageUrl }] });
  });
  assert.equal(shown.called, true);
  assert.equal(shown.simulation, false);
  assert.equal(shown.ok, true);
  assert.equal(shown.url, imageUrl);
  assert.equal(JSON.stringify(shown).includes("image-test"), false);

  const nested = await executeImage(product, ready, async () => jsonResponse(200, {
    data: [{ image_url: { url: imageUrl } }],
  }));
  assert.equal(nested.url, imageUrl);
  assert.equal(nested.simulation, false);

  const dash = await executeImage(product, ready, async () => jsonResponse(200, {
    output: { results: [{ url: imageUrl }] },
  }));
  assert.equal(dash.url, imageUrl);

  const encoded = await executeImage(product, ready, async () => jsonResponse(200, {
    data: [{ b64_json: png }],
  }));
  assert.equal(encoded.simulation, false);
  assert.equal(encoded.called, true);
  assert.equal(encoded.url, `data:image/png;base64,${png}`);

  const quoted = await executeImage(product, {
    IMAGE_API_BASE: '"http://image.test.local/"',
    IMAGE_MODEL: "'image-fixture'",
    IMAGE_API_KEY: '"image-test"',
    GUIDE_IMAGE_ENABLED: "true",
  }, async (url, init) => {
    assert.equal(String(url), "http://image.test.local/images/generations");
    assert.equal(init.headers.Authorization, "Bearer image-test");
    return jsonResponse(200, { data: [{ url: imageUrl }] });
  });
  assert.equal(quoted.url, imageUrl);

  const rejected = await executeImage(product, ready, async () => jsonResponse(400, {
    error: { message: "size rejected", type: "invalid_request_error" },
  }));
  assert.equal(rejected.called, true);
  assert.equal(rejected.simulation, false);
  assert.equal(rejected.url, "");
  assert.equal(rejected.label, "生图接口返回 HTTP 400");
  assert.equal(rejected.label.includes("演示回放"), false);
  assert.equal(rejected.label.includes("size rejected"), false);
  assert.equal(rejected.label.includes("image-test"), false);

  const empty = await executeImage(product, ready, async () => jsonResponse(200, {
    error: { message: "no image" },
  }));
  assert.equal(empty.called, true);
  assert.equal(empty.simulation, false);
  assert.equal(empty.url, "");
  assert.equal(empty.label, "返回里没有图片地址");
  assert.equal(empty.label.includes("演示回放"), false);
  assert.equal(empty.label.includes("no image"), false);
}

await check(executeGuide);
await check(executeServer);

const card = readFileSync(new URL("../components/chat/moments/MomentsResultCard.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
assert.match(card, /imagePlaceholder/);
assert.match(card, /generatedImageUrl/);
assert.match(app, /没有调用生图接口/);
assert.match(app, /返回里没有图片地址/);
assert.match(app, /active\.image\.url/);
console.log("ok image call");
