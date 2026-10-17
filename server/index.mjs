import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {applyTurn, confirmProduct, createState, productById, publicCatalog} from './guide.mjs';
import {executeImage} from './image.mjs';
import {executeLiveCopy, modelStatus} from './model-config.mjs';
import {reflect} from './reflect.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const customers = [
  {id: 'guest-a', name: '小陈'},
  {id: 'guest-b', name: '林女士'}
];
const sessions = new Map();
const memory = {guide: [], customers: {'guest-a': [], 'guest-b': []}};
let memorySeq = 1;

function loadEnvFile() {
  const file = path.join(root, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const matched = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!matched || process.env[matched[1]] != null) continue;
    process.env[matched[1]] = matched[2].trim();
  }
}

function send(response, status, body, type = 'application/json; charset=utf-8') {
  const payload = Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body);
  response.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
  response.end(payload);
}

function customerName(id) {
  return customers.find(item => item.id === id)?.name || '顾客';
}

function blankRecord() {
  return {state: createState(), messages: [], image: null, updatedAt: 0};
}

function makeMemory(scope, customerId, key, value) {
  return {
    id: 'm' + memorySeq++,
    scope,
    customer_id: scope === 'guide' ? null : customerId,
    key: String(key || '').slice(0, 40),
    value: String(value || '').slice(0, 240),
    status: 'remembered',
    verified: false,
    promoted: false,
    note: '这是记下的经验，不是已验证事实，也不会自动升成规则。'
  };
}

function guideTone() {
  return memory.guide.find(item => item.key === '语气')?.value || null;
}

function visibleMemory(customerId) {
  return {guide: memory.guide, customer: memory.customers[customerId] || []};
}

function sessionFor(customerId) {
  const id = customerId === 'guest-b' ? 'guest-b' : 'guest-a';
  if (!sessions.has(id)) sessions.set(id, blankRecord());
  return {id, record: sessions.get(id)};
}

function remember(record, message) {
  record.messages.push(message);
  record.updatedAt = Date.now();
  if (record.messages.length > 40) record.messages.splice(0, record.messages.length - 40);
}

function summary(id, record) {
  const last = [...record.messages].reverse().find(item => item.role === 'user');
  const product = record.state.confirmed_product_id ? productById(record.state.confirmed_product_id) : null;
  return {
    id,
    name: customerName(id),
    preview: last?.text || '还没有这位顾客的需求',
    revision: record.state.revision,
    confirmed_name: product?.name || null,
    updatedAt: record.updatedAt
  };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function view(result, customerId) {
  const status = modelStatus();
  const record = sessions.get(customerId);
  return {
    ok: result.ok,
    error: result.error || null,
    status: result.status || null,
    reply: result.reply || null,
    searched: Boolean(result.searched),
    composed: Boolean(result.composed),
    customer_id: customerId,
    customer_name: customerName(customerId),
    mode: status.mode,
    guide_tone: guideTone(),
    messages: record?.messages || [],
    state: result.state,
    reflection: reflect(result.state),
    memories: visibleMemory(customerId),
    image: record?.image && record.image.product_id === result.state?.confirmed_product_id ? record.image : null
  };
}

async function maybeLiveCopy(result) {
  const status = modelStatus();
  if (!result.ok || !result.composed || !result.state?.card || !status.ready) return result;
  const product = productById(result.state.confirmed_product_id);
  const live = await executeLiveCopy({
    product,
    maxChars: result.state.copy_requirement?.max_chars || 200,
    factIds: [product.id],
    promotions: result.state.card.promotions
  });
  if (!live.response) {
    result.state.card = null;
    result.status = 'live_error';
    result.reply = '真实模型没有返回可用文案，已停止。没有用演示稿冒充模型结果。';
    return result;
  }
  let payload;
  try {
    const raw = await live.response.json();
    payload = JSON.parse(raw.choices?.[0]?.message?.content || '');
  } catch {
    result.state.card = null;
    result.status = 'live_error';
    result.reply = '真实模型输出无法解析，已停止。没有用演示稿冒充模型结果。';
    return result;
  }
  const text = String(payload.text || '');
  const grounded = text.includes(product.name) && text.includes(String(product.price_cny));
  const clean = !['终身保修', '免费送装', '环保', '舒适', '终身质保'].some(item => text.includes(item));
  if (!grounded || !clean) {
    result.state.card = null;
    result.status = 'live_error';
    result.reply = '真实模型文案没有通过事实校验，已停止。没有用演示稿冒充模型结果。';
    return result;
  }
  result.state.card = {...result.state.card, text, simulation: false, pending_human: true};
  result.reply = '模型已生成文案，仍需你在页面上核对后采用。';
  return result;
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/model-status') {
    send(response, 200, modelStatus());
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/session') {
    const session = sessionFor(url.searchParams.get('customer_id'));
    send(response, 200, view({ok: true, status: 'current', reply: null, state: session.record.state}, session.id));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/sessions') {
    const list = customers.map(item => summary(item.id, sessionFor(item.id).record));
    send(response, 200, {sessions: list, guide_tone: guideTone(), memory});
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/memory') {
    const body = await readJson(request);
    const session = sessionFor(body.customer_id);
    if (body.tone === '简洁' || body.tone === '热情') {
      const existing = memory.guide.find(item => item.key === '语气');
      if (existing) existing.value = body.tone;
      else memory.guide.push(makeMemory('guide', null, '语气', body.tone));
    } else if (body.action === 'remember' && (body.scope === 'guide' || body.scope === 'customer')) {
      const scope = body.scope === 'guide' ? 'guide' : 'customer';
      const bucket = scope === 'guide' ? memory.guide : memory.customers[session.id];
      bucket.push(makeMemory(scope, session.id, body.key, body.value));
    } else if (body.action === 'delete') {
      if (!body.id) memory.guide = memory.guide.filter(item => item.key !== '语气');
      else {
        memory.guide = memory.guide.filter(item => item.id !== body.id);
        memory.customers[session.id] = (memory.customers[session.id] || []).filter(item => item.id !== body.id);
      }
    }
    send(response, 200, {guide_tone: guideTone(), memories: visibleMemory(session.id), memory});
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/image') {
    const body = await readJson(request);
    const session = sessionFor(body.customer_id);
    if (session.record.state.revision !== Number(body.revision)) {
      send(response, 409, view({ok: false, error: 'revision_conflict', state: session.record.state}, session.id));
      return;
    }
    const product = productById(session.record.state.confirmed_product_id);
    if (!product) {
      send(response, 409, view({ok: false, error: 'need_confirm', reply: '先点选确认商品，再准备配图。', state: session.record.state}, session.id));
      return;
    }
    const generated = await executeImage(product);
    session.record.image = {
      simulation: generated.simulation,
      called: generated.called,
      pending_human: true,
      label: generated.label,
      product_id: product.id,
      url: generated.url || '',
      request: generated.request
    };
    remember(session.record, {role: 'assistant', text: generated.simulation ? '配图仍是演示回放，待核对，没有调用生图接口。' : '配图已请求，结果仍待核对。'});
    send(response, 200, view({ok: true, status: 'image', reply: session.record.messages.at(-1).text, state: session.record.state}, session.id));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/catalog') {
    send(response, 200, {products: publicCatalog(), synthetic: true});
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/reset') {
    const body = await readJson(request);
    const session = sessionFor(body.customer_id);
    session.record.state = createState();
    session.record.messages = [];
    session.record.image = null;
    session.record.updatedAt = Date.now();
    send(response, 200, view({ok: true, status: 'reset', reply: '已清空这位顾客的本次选品，其他顾客不受影响。', state: session.record.state}, session.id));
    return;
  }
  if (request.method === 'POST' && (url.pathname === '/api/turn' || url.pathname === '/api/confirm')) {
    const body = await readJson(request);
    const session = sessionFor(body.customer_id);
    const text = String(body.text || '');
    const result = url.pathname === '/api/confirm'
      ? confirmProduct(session.record.state, body.product_id, body.revision)
      : applyTurn(session.record.state, text, body.revision);
    const settled = await maybeLiveCopy(result);
    if (settled.ok) {
      if (url.pathname === '/api/turn' && text) remember(session.record, {role: 'user', text});
      if (url.pathname === '/api/confirm') {
      const chosen = productById(body.product_id);
      remember(session.record, {role: 'user', text: '确认了' + (chosen?.name || '这件商品')});
    }
      session.record.state = settled.state;
      if (settled.reply) remember(session.record, {role: 'assistant', text: settled.reply, status: settled.status});
    }
    send(response, settled.ok ? 200 : 409, view(settled, session.id));
    return;
  }
  send(response, 404, {error: 'not_found'});
}

const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8'};

export function start(port = 4173) {
  loadEnvFile();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    try {
      if (url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url);
        return;
      }
      const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
      const file = path.join(publicDir, relative);
      if (!file.startsWith(publicDir)) {
        send(response, 403, 'forbidden', 'text/plain; charset=utf-8');
        return;
      }
      const body = await readFile(file);
      send(response, 200, body, types[path.extname(file)] || 'application/octet-stream');
    } catch (error) {
      send(response, error && error.code === 'ENOENT' ? 404 : 500, {error: 'server_error'});
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  start(4173).then(server => {
    const address = server.address();
    console.log('guide-agent h5 http://127.0.0.1:' + address.port);
  });
}
