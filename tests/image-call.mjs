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
    const body = JSON.parse(String(init.body));
    assert.equal(JSON.stringify(body).includes("1024x1024"), false);
    assert.equal(body.size, "1024*1024");
    assert.equal(body.n, 1);
    assert.equal(body.response_format, undefined);
    assert.deepEqual(Object.keys(body).sort(), ["model", "n", "prompt", "size"]);
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

  const qwen = await executeImage(product, { ...ready, IMAGE_MODEL: "qwen-image-plus" }, async (_url, init) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "qwen-image-plus");
    assert.equal(body.size, "1328*1328");
    assert.equal(body.n, 1);
    assert.equal(body.response_format, undefined);
    assert.equal(JSON.stringify(body).includes("1024x1024"), false);
    assert.deepEqual(Object.keys(body).sort(), ["model", "n", "prompt", "size"]);
    return jsonResponse(200, { data: [{ url: imageUrl }] });
  });
  assert.equal(qwen.url, imageUrl);
  assert.equal(qwen.called, true);
  assert.equal(qwen.simulation, false);

  const rejected = await executeImage(product, ready, async () => jsonResponse(400, {
    error: { message: "InvalidParameter", type: "invalid_request_error" },
  }));
  assert.equal(rejected.called, true);
  assert.equal(rejected.simulation, false);
  assert.equal(rejected.url, "");
  assert.equal(rejected.label, "生图接口返回 HTTP 400（/images/generations）：InvalidParameter");
  assert.equal(rejected.label.includes("演示回放"), false);
  assert.equal(rejected.label.includes("invalid_request_error"), false);
  assert.equal(rejected.label.includes("image-test"), false);

  const coded = await executeImage(product, ready, async () => jsonResponse(400, {
    code: "InvalidParameter",
  }));
  assert.equal(coded.called, true);
  assert.equal(coded.simulation, false);
  assert.equal(coded.url, "");
  assert.equal(coded.label, "生图接口返回 HTTP 400（/images/generations）：InvalidParameter");

  const leaked = await executeImage(product, ready, async () => jsonResponse(400, {
    message: "InvalidParameter image-test sk-abcdefghijklmnopqrstuvwxyz",
  }));
  assert.equal(leaked.label, "生图接口返回 HTTP 400（/images/generations）：InvalidParameter");
  assert.equal(leaked.label.includes("image-test"), false);
  assert.equal(leaked.label.includes("sk-"), false);

  const empty = await executeImage(product, ready, async () => jsonResponse(200, {
    error: { message: "no image" },
  }));
  assert.equal(empty.called, true);
  assert.equal(empty.simulation, false);
  assert.equal(empty.url, "");
  assert.equal(empty.label, "返回里没有图片地址");
  assert.equal(empty.label.includes("演示回放"), false);
  assert.equal(empty.label.includes("no image"), false);

  const pictured = {
    ...product,
    image: "/demo/sofa.png",
    image_url: "http://localhost:3000/products/S01.png",
  };
  const doubled = await executeImage(pictured, {
    ...ready,
    IMAGE_API_BASE: "http://image.test.local/images/generations/",
  }, async (url, init) => {
    assert.equal(String(url), "http://image.test.local/images/generations");
    const body = JSON.parse(String(init.body));
    assert.equal(body.image, undefined);
    assert.equal(body.image_url, undefined);
    assert.deepEqual(Object.keys(body).sort(), ["model", "n", "prompt", "size"]);
    const raw = JSON.stringify(body);
    assert.equal(raw.includes("/demo/"), false);
    assert.equal(raw.includes("localhost"), false);
    assert.equal(raw.includes("/products/S01.png"), false);
    return jsonResponse(200, { data: [{ url: imageUrl }] });
  });
  assert.equal(doubled.url, imageUrl);

  const compat = await executeImage(pictured, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations",
    IMAGE_MODEL: "qwen-image-plus",
  }, async (url, init) => {
    assert.equal(String(url), "https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations");
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "qwen-image-plus");
    assert.equal(body.size, "1024x1024");
    assert.equal(body.n, 1);
    assert.equal(body.response_format, undefined);
    assert.equal(body.image, undefined);
    assert.equal(String(body.size).includes("*"), false);
    assert.deepEqual(Object.keys(body).sort(), ["model", "n", "prompt", "size"]);
    const raw = JSON.stringify(body);
    assert.equal(raw.includes("/demo/"), false);
    assert.equal(raw.includes("localhost"), false);
    return jsonResponse(200, { data: [{ url: imageUrl }] });
  });
  assert.equal(compat.url, imageUrl);

  const compatBase = await executeImage(product, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    IMAGE_MODEL: "qwen-image-plus",
  }, async (url, init) => {
    assert.equal(String(url), "https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations");
    const body = JSON.parse(String(init.body));
    assert.deepEqual(Object.keys(body).sort(), ["model", "n", "prompt", "size"]);
    return jsonResponse(200, { data: [{ url: imageUrl }] });
  });
  assert.equal(compatBase.url, imageUrl);

  let nativeCalls = 0;
  const qwenPicture = "https://example.com/a.png";
  const native = await executeImage(pictured, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/api/v1/",
    IMAGE_MODEL: "qwen-image-plus",
  }, async (url, init) => {
    nativeCalls += 1;
    assert.equal(String(url), "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
    assert.equal(String(url).includes("/images/generations"), false);
    assert.equal(String(url).includes("text2image"), false);
    assert.equal(init.headers["X-DashScope-Async"], undefined);
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "qwen-image-plus");
    assert.equal(body.input.messages[0].role, "user");
    assert.equal(body.input.messages[0].content[0].text.includes("云朵双人沙发"), true);
    assert.equal(body.input.messages[0].content[0].image, undefined);
    assert.equal(body.parameters.size, "2048*2048");
    assert.equal(body.parameters.n, 1);
    assert.equal(body.parameters.watermark, false);
    assert.equal(body.input.prompt, undefined);
    assert.equal(body.image, undefined);
    assert.equal(body.image_url, undefined);
    const raw = JSON.stringify(body);
    assert.equal(raw.includes('"image"'), false);
    assert.equal(raw.includes("/demo/"), false);
    assert.equal(raw.includes("localhost"), false);
    assert.equal(raw.includes("/products/S01.png"), false);
    return jsonResponse(200, {
      output: { choices: [{ message: { content: [{ image: qwenPicture }] } }] },
    });
  });
  assert.equal(nativeCalls, 1);
  assert.equal(native.called, true);
  assert.equal(native.simulation, false);
  assert.equal(native.url, qwenPicture);

  let wanCalls = 0;
  const wan = await executeImage(product, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/api/v1",
    IMAGE_MODEL: "wan2.6-t2i",
  }, async (url, init) => {
    wanCalls += 1;
    if (init?.body) {
      assert.equal(String(url), "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis");
      assert.equal(init.headers["X-DashScope-Async"], "enable");
      const body = JSON.parse(String(init.body));
      assert.equal(body.model, "wan2.6-t2i");
      assert.equal(body.input.prompt.includes("云朵双人沙发"), true);
      assert.equal(body.input.messages, undefined);
      return jsonResponse(200, { output: { task_id: "task-wan", task_status: "PENDING" } });
    }
    assert.equal(String(url), "https://dashscope.aliyuncs.com/api/v1/tasks/task-wan");
    assert.equal(init.method, "GET");
    return jsonResponse(200, { output: { task_status: "SUCCEEDED", results: [{ url: imageUrl }] } });
  });
  assert.equal(wanCalls, 2);
  assert.equal(wan.called, true);
  assert.equal(wan.url, imageUrl);

  const chatBase = await executeImage(product, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    IMAGE_MODEL: "qwen-image-plus",
  }, async (url, init) => {
    assert.equal(String(url).includes("chat/completions"), false);
    assert.equal(String(url), "https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations");
    const body = JSON.parse(String(init.body));
    assert.deepEqual(Object.keys(body).sort(), ["model", "n", "prompt", "size"]);
    return jsonResponse(200, { data: [{ url: imageUrl }] });
  });
  assert.equal(chatBase.url, imageUrl);

  const nativeChat = await executeImage(product, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/api/v1/chat/completions",
    IMAGE_MODEL: "qwen-image-plus",
  }, async (url) => {
    assert.equal(String(url).includes("chat/completions"), false);
    assert.equal(String(url), "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
    return jsonResponse(200, {
      output: { choices: [{ message: { content: [{ image: qwenPicture }] } }] },
    });
  });
  assert.equal(nativeChat.url, qwenPicture);

  const urlError = await executeImage(pictured, ready, async () => jsonResponse(400, {
    code: "InvalidParameter",
    message: "url error, please check url！ For details, see: https://www.alibabacloud.com/help",
  }));
  assert.equal(urlError.called, true);
  assert.equal(urlError.simulation, false);
  assert.equal(urlError.url, "");
  assert.equal(urlError.label, "生图接口返回 HTTP 400（/images/generations）：url error, please check url！ For details, see: https://www.alibabacloud.com/help");
  assert.equal(urlError.label.includes("image-test"), false);
  assert.equal(urlError.label.includes("image.test.local"), false);
  assert.equal(urlError.label.includes("/demo/"), false);
  assert.equal(urlError.label.includes("演示回放"), false);

  const pathError = await executeImage(pictured, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/api/v1?token=secret",
    IMAGE_MODEL: "qwen-image-plus",
  }, async () => jsonResponse(400, {
    code: "InvalidParameter",
    message: "url error, please check url！ For details, see: https://www.alibabacloud.com/help",
  }));
  assert.equal(pathError.label, "生图接口返回 HTTP 400（/api/v1/services/aigc/multimodal-generation/generation）：url error, please check url！ For details, see: https://www.alibabacloud.com/help");
  assert.equal(pathError.label.includes("dashscope"), false);
  assert.equal(pathError.label.includes("token"), false);
  assert.equal(pathError.label.includes("image-test"), false);
  assert.equal(pathError.label.length <= 160, true);

  await testQwenImageApiReference(executeImage);
  await testQwenImageCompatibleMode(executeImage);

  const capped = await executeImage(product, ready, async () => jsonResponse(400, {
    message: "x".repeat(400),
  }));
  assert.equal(capped.label.includes("（/images/generations）"), true);
  assert.equal(capped.label.length <= 160, true);
}

const qwenImageDoc = "https://www.alibabacloud.com/help/en/model-studio/qwen-image-api";
const compatibleImageDoc = "https://www.alibabacloud.com/help/en/model-studio/qwen-image-generation-and-editing-api-reference";

function docHeaders(init, doc) {
  assert.equal(init.headers["Content-Type"], "application/json", doc);
  assert.equal(init.headers["X-DashScope-Async"], undefined, doc);
  assert.equal(init.headers["X-DashScope-SSE"], undefined, doc);
}

async function testQwenImageApiReference(executeImage) {
  const doc = `Qwen-Image API reference ${qwenImageDoc}`;
  await executeImage(product, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/api/v1",
    IMAGE_MODEL: "qwen-image-plus",
  }, async (url, init) => {
    assert.equal(String(url), "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", doc);
    assert.equal(String(url).includes("text2image"), false, doc);
    docHeaders(init, doc);
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "qwen-image-plus", doc);
    assert.equal(body.input.messages.length, 1, doc);
    assert.equal(body.input.messages[0].role, "user", doc);
    assert.equal(Object.keys(body.input.messages[0].content[0]).join(","), "text", doc);
    assert.equal(body.parameters.size, "2048*2048", doc);
    assert.equal(body.parameters.n, 1, doc);
    assert.equal(body.parameters.watermark, false, doc);
    assert.equal(body.input.prompt, undefined, doc);
    assert.deepEqual(Object.keys(body).sort(), ["input", "model", "parameters"], doc);
    assert.deepEqual(Object.keys(body.parameters).sort(), ["n", "size", "watermark"], doc);
    return jsonResponse(200, { output: { choices: [{ message: { content: [{ image: "https://example.com/a.png" }] } }] } });
  });
  await executeImage(product, {
    ...ready,
    IMAGE_API_BASE: "https://dashscope.aliyuncs.com/api/v1/chat/completions",
    IMAGE_MODEL: "qwen-image-plus",
  }, async (url, init) => {
    assert.equal(String(url).includes("/chat/completions"), false, doc);
    assert.equal(String(url), "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", doc);
    docHeaders(init, doc);
    const body = JSON.parse(String(init.body));
    assert.equal(body.parameters.size, "2048*2048", doc);
    return jsonResponse(200, { output: { choices: [{ message: { content: [{ image: "https://example.com/a.png" }] } }] } });
  });
}

async function testQwenImageCompatibleMode(executeImage) {
  const doc = `Qwen Image Generation and Editing API Reference ${compatibleImageDoc}`;
  const bases = [
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations",
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  ];
  for (const base of bases) {
    await executeImage(product, {
      ...ready,
      IMAGE_API_BASE: base,
      IMAGE_MODEL: "qwen-image-plus",
    }, async (url, init) => {
      assert.equal(String(url), "https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations", doc);
      assert.equal(String(url).includes("/chat/completions"), false, doc);
      assert.equal((String(url).match(/\/images\/generations/g) || []).length, 1, doc);
      docHeaders(init, doc);
      const body = JSON.parse(String(init.body));
      assert.equal(body.model, "qwen-image-plus", doc);
      assert.equal(body.size, "1024x1024", doc);
      assert.equal(body.n, 1, doc);
      assert.equal(String(body.size).includes("*"), false, doc);
      assert.equal(body.image, undefined, doc);
      assert.equal(body.input, undefined, doc);
      assert.deepEqual(Object.keys(body).sort(), ["model", "n", "prompt", "size"], doc);
      return jsonResponse(200, { data: [{ url: imageUrl }] });
    });
  }
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
