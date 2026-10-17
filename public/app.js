const prompts = [
  '浅色沙发，预算3000元，宽度不超过180厘米，不要皮质',
  '预算3000元，想买适合小户型的沙发',
  '只看沙发，预算最多2299元',
  '便宜点'
];

let screen = 'home';
let sessionId = null;
let scene = 'search';
let backTo = 'home';
let catalog = [];
let model = {mode: 'simulation'};
let sessionList = [];
let favoriteList = [];
let hubTab = 'recent';
let active = null;
let guideTone = null;
let memoryBook = {guide: [], sessions: {}};
let pendingLabel = '';
let busy = false;
let renameTarget = null;

const $ = selector => document.querySelector(selector);

function show(next, options = {}) {
  screen = next;
  document.body.dataset.screen = next;
  for (const id of ['home', 'sessions', 'chat', 'settings']) {
    $(`#${id}`).hidden = id !== next;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-current', tab.dataset.screen === next ? 'page' : 'false');
  }
  if (options.back) backTo = options.back;
}

function constraintLines(state) {
  const items = state?.constraints || {};
  return [
    ['预算', items.budget_max_cny == null ? '未填' : items.budget_max_cny + ' 元'],
    ['宽度', items.width_max_cm == null ? '不限' : items.width_max_cm + ' 厘米'],
    ['品类', items.category || '不限'],
    ['颜色', items.color || '不限'],
    ['排除材质', items.exclude_material || '无']
  ];
}

function suggestions(state) {
  const question = state?.pending_question || '';
  if (question.includes('宽度')) return ['宽度不超过160厘米', '宽度不超过180厘米'];
  if (question.includes('不会自行降低')) return ['预算改成2400元', '预算改成2600元'];
  if (question.includes('不会自行放宽')) return ['预算提高到3000元，还是沙发', '改看餐桌，预算不变'];
  if (question.includes('一种材质')) return ['不要皮质', '不要布艺'];
  if (scene === 'copy' && state?.confirmed_product_id) return ['简洁一些', '语气热情些，字数要求不变', '请写自然文案，最多80字'];
  return [];
}

function renderHome() {
  const latest = [...sessionList].filter(item => item.revision > 0).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const card = $('#continue-card');
  card.replaceChildren();
  if (!latest) {
    const empty = document.createElement('p');
    empty.className = 'pad muted';
    empty.textContent = '暂无选品记录。';
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'text-btn tap';
    link.textContent = '去会话中心开启新对话 ›';
    link.addEventListener('click', () => show('sessions'));
    card.append(empty, link);
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'session tap';
    const title = document.createElement('strong');
    title.textContent = latest.name;
    const preview = document.createElement('small');
    preview.textContent = latest.preview;
    const span = document.createElement('span');
    span.append(title, preview);
    button.append(span);
    button.addEventListener('click', () => openChat(latest.id, 'home'));
    card.append(button);
  }
  const box = $('#home-prompts');
  box.replaceChildren();
  for (const text of prompts) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'prompt tap';
    button.textContent = text;
    button.addEventListener('click', () => ask(text));
    box.append(button);
  }
}

function renderFavorites() {
  const list = $('#session-list');
  list.replaceChildren();
  if (!favoriteList.length) {
    const empty = document.createElement('p');
    empty.className = 'pad muted';
    empty.textContent = '还没有收藏。确认商品或生成话术后可以收藏。';
    list.append(empty);
    return;
  }
  for (const item of favoriteList) {
    const row = document.createElement('div');
    row.className = 'session';
    const span = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const preview = document.createElement('small');
    preview.textContent = item.content;
    span.append(title, preview);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-btn tap';
    remove.textContent = '取消收藏';
    remove.addEventListener('click', () => toggleFavorite(item.source_id, item.kind, item.title, item.content));
    row.append(span, remove);
    list.append(row);
  }
}

function renderSessions() {
  $('#tab-recent').classList.toggle('is-on', hubTab === 'recent');
  $('#tab-favorites').classList.toggle('is-on', hubTab === 'favorites');
  $('#tab-recent').setAttribute('aria-pressed', String(hubTab === 'recent'));
  $('#tab-favorites').setAttribute('aria-pressed', String(hubTab === 'favorites'));
  if (hubTab === 'favorites') {
    renderFavorites();
    return;
  }
  const list = $('#session-list');
  list.replaceChildren();
  if (!sessionList.length) {
    const empty = document.createElement('p');
    empty.className = 'pad muted';
    empty.textContent = '还没有会话。';
    list.append(empty);
    return;
  }
  for (const item of sessionList) {
    const row = document.createElement('div');
    row.className = 'session';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'prompt tap';
    const title = document.createElement('strong');
    title.textContent = item.name;
    const preview = document.createElement('small');
    preview.textContent = item.preview;
    const span = document.createElement('span');
    span.append(title, preview);
    if (item.confirmed_name) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = '已确认 ' + item.confirmed_name;
      span.append(tag);
    }
    open.append(span);
    open.addEventListener('click', () => openChat(item.id, 'sessions'));
    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'text-btn tap';
    rename.textContent = '改名';
    rename.addEventListener('click', () => openRename(item.id, item.customer_name || ''));
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'text-btn tap';
    clear.textContent = '清空';
    clear.addEventListener('click', () => resetSession(item.id));
    row.append(open, rename, clear);
    list.append(row);
  }
}

function renderSettings() {
  const mode = model.mode === 'live' ? '真实生文已启用，话术仍需人工核对。' : '演示回放。商品筛选和活动校验在本地完成，没有调用真实生文或生图。';
  $('#mode-card').textContent = mode + ' 生文密钥写在 .env 的 DASHSCOPE_API_KEY；生图用 IMAGE_API_BASE、IMAGE_MODEL、IMAGE_API_KEY。页面不填写密钥。';
  $('#tone-line').textContent = guideTone
    ? `已记住导购语气：${guideTone}。它不会变成这次选品的预算或商品条件，也不会当成已验证事实。`
    : '还没有记住语气。这是导购自己的偏好，不会写进这次选品条件。';
  const box = $('#memory-card');
  box.replaceChildren();
  const groups = [];
  if ((memoryBook.guide || []).length) groups.push(['导购', memoryBook.guide]);
  for (const item of sessionList) {
    const memories = memoryBook.sessions?.[item.id] || [];
    if (memories.length) groups.push([item.name, memories]);
  }
  if (!groups.length) {
    const heading = document.createElement('p');
    heading.className = 'muted';
    heading.textContent = '还没有记住的内容。';
    box.append(heading);
  }
  for (const [label, items] of groups) {
    const heading = document.createElement('p');
    heading.className = 'muted';
    heading.textContent = label;
    box.append(heading);
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'memory-row';
      const text = document.createElement('span');
      text.textContent = item.key + '：' + item.value + '（未验证）';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'text-btn tap';
      button.textContent = '删除';
      button.addEventListener('click', () => forgetMemory(item.id));
      row.append(text, button);
      box.append(row);
    }
  }
  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = '清空会话不会删除已记住的内容；删除只作用于点到的那一条。';
  box.append(note);
}

function reasonFor(product, state) {
  const parts = [`${product.color}${product.material}`, `宽 ${product.width_cm} 厘米`, `标价 ${product.price_cny} 元`];
  if (state.constraints.budget_max_cny != null) parts.push(`未超过预算 ${state.constraints.budget_max_cny} 元`);
  return parts.join('，') + '。理由只来自商品资料。';
}

function favoriteButton(sourceId, kind, title, content) {
  const saved = favoriteList.some(item => item.source_id === sourceId);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip-btn tap';
  button.textContent = saved ? '已收藏' : '收藏';
  button.addEventListener('click', () => toggleFavorite(sourceId, kind, title, content));
  return button;
}

function renderChat() {
  const customerName = active?.customer_name || '';
  $('#chat-title').textContent = customerName || (scene === 'copy' ? '推荐话术' : '选品推荐');
  $('#rename-current').textContent = customerName ? '客户：' + customerName : '改成客户名';
  for (const button of document.querySelectorAll('[data-scene]')) {
    button.classList.toggle('is-on', button.dataset.scene === scene);
  }
  const state = active?.state;
  const progress = $('#progress');
  progress.replaceChildren();
  const flags = [
    ['识别需求', Boolean(state && constraintLines(state).some(([, value]) => value !== '未填' && value !== '不限' && value !== '无'))],
    ['查询商品', Boolean(state?.candidate_ids?.length)],
    ['确认商品', Boolean(state?.confirmed_product_id)],
    ['核实活动', Boolean(state?.card?.promotions)],
    ['推荐话术', Boolean(state?.card)]
  ];
  for (const [label, on] of flags) {
    const node = document.createElement('span');
    node.className = 'step' + (on ? ' is-on' : '');
    node.textContent = label;
    progress.append(node);
  }
  const facts = $('#fact-body');
  facts.replaceChildren();
  for (const [label, value] of constraintLines(state)) {
    const line = document.createElement('p');
    line.className = 'fact';
    line.textContent = label + '：' + value;
    facts.append(line);
  }
  const thread = $('#thread');
  thread.replaceChildren();
  const messages = active?.messages || [];
  if (!messages.length) {
    const empty = document.createElement('p');
    empty.className = 'bubble assistant';
    empty.textContent = scene === 'copy'
      ? '先点选确认商品，再生成话术。聊天里说“你替我确认”不会代替点选。'
      : '说说预算、宽度、颜色或材质。';
    thread.append(empty);
  }
  for (const message of messages) {
    const bubble = document.createElement('p');
    bubble.className = 'bubble ' + (message.role === 'user' ? 'user' : 'assistant');
    bubble.textContent = message.text;
    thread.append(bubble);
  }
  if (!state?.pending_question && state?.candidate_ids?.length && !state?.confirmed_product_id) {
    for (const id of state.candidate_ids || []) {
      const product = catalog.find(item => item.id === id);
      if (!product) continue;
      const card = document.createElement('article');
      card.className = 'product';
      const photo = document.createElement('img');
      photo.className = 'shot';
      photo.alt = product.name + '示意图';
      photo.src = '/products/' + product.id + '.png';
      card.append(photo);
      const title = document.createElement('h2');
      title.textContent = product.name;
      const meta = document.createElement('p');
      meta.className = 'muted';
      meta.textContent = `${product.model} · ${product.category}`;
      const price = document.createElement('p');
      price.className = 'price';
      price.textContent = product.price_cny + ' 元';
      const reason = document.createElement('p');
      reason.className = 'reason';
      reason.textContent = reasonFor(product, state);
      const failed = active?.reflection?.failed_targets?.includes(product.id);
      if (failed) {
        const hold = document.createElement('p');
        hold.className = 'check fail';
        hold.textContent = '待核对。这件商品没有通过本轮约束核查，不能确认成已通过。';
        card.append(title, meta, price, reason, hold);
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'confirm tap';
        button.textContent = '确认这件商品';
        button.addEventListener('click', () => confirmProduct(product.id));
        const save = favoriteButton('product:' + product.id, 'product', product.name, reason.textContent);
        card.append(title, meta, price, reason, button, save);
      }
      thread.append(card);
    }
  }
  if (active?.reflection?.checks?.length) {
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'reflection';
    const title = document.createElement('h2');
    title.textContent = active.reflection.pending_review ? '反思核查 · 待核对' : '反思核查';
    panel.append(title);
    for (const check of active.reflection.checks) {
      const line = document.createElement('p');
      line.className = 'check' + (check.ok ? '' : ' fail');
      line.textContent = (check.ok ? '通过' : '未通过') + ' · ' + check.name + ' · ' + check.detail;
      panel.append(line);
    }
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = active.reflection.note;
    panel.append(note);
    thread.append(panel);
  }
  if (state?.card) {
    const draft = document.createElement('article');
    draft.className = 'draft';
    const title = document.createElement('h2');
    title.textContent = state.card.simulation ? '演示回放 · 推荐话术' : '待核对话术';
    const body = document.createElement('p');
    body.textContent = state.card.text;
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = '待人工核对，尚未发给顾客。';
    draft.append(title, body, note);
    if (state.card.promotions?.length) {
      const promo = document.createElement('p');
      promo.className = 'muted';
      promo.textContent = '仍在有效期内、尚未判断能否一起用的活动：' + state.card.promotions.map(item => item.id + ' 减 ' + item.discount_cny + ' 元').join('，');
      draft.append(promo);
    }
    const actions = document.createElement('div');
    actions.className = 'actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'chip-btn tap';
    copy.textContent = '复制';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(state.card.text); } catch { /* 演示页无剪贴板权限时仍标记已点到 */ }
      copy.textContent = '已复制';
    });
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'chip-btn tap';
    again.textContent = '重新生成话术';
    again.addEventListener('click', () => withPending('正在生成话术…', () => send('请按同一件商品再写一版推荐话术，事实不变')));
    const picture = document.createElement('button');
    picture.type = 'button';
    picture.className = 'chip-btn tap';
    picture.id = 'make-image';
    picture.textContent = '生成配图';
    picture.addEventListener('click', () => withPending('正在准备配图…', () => post('/api/image', {})));
    const saveCopy = favoriteButton('copy:' + sessionId, 'material', '推荐话术', state.card.text);
    actions.append(copy, again, picture, saveCopy);
    draft.append(actions);
    thread.append(draft);
  }
  if (active?.image) {
    const shot = document.createElement('article');
    shot.className = 'draft';
    shot.id = 'image-card';
    const title = document.createElement('h2');
    title.textContent = active.image.label || '演示回放、待核对';
    const note = document.createElement('p');
    note.className = 'muted';
    if (active.image.url) {
      const picture = document.createElement('img');
      picture.className = 'shot';
      picture.alt = '待核对的配图';
      picture.src = active.image.url;
      shot.append(title, picture);
      note.textContent = '配图已返回，仍待核对。密钥不会出现在页面上。';
    } else {
      const box = document.createElement('div');
      box.className = 'placeholder';
      box.textContent = '演示回放、待核对';
      shot.append(title, box);
      note.textContent = active.image.called
        ? '接口没有返回可用图片地址，仍待核对。密钥不会出现在页面上。'
        : '没有调用生图接口。请求体已留好：模型、提示词、尺寸和张数，密钥不出现在页面上。';
    }
    shot.append(note);
    thread.append(shot);
  }
  const lines = constraintLines(state).filter(([, value]) => value !== '未填' && value !== '不限' && value !== '无');
  if (lines.length || state?.confirmed_product_id) {
    const remember = document.createElement('div');
    remember.className = 'actions';
    if (lines.length) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-btn tap';
      button.id = 'remember-constraints';
      button.textContent = '记住这次约束';
      button.addEventListener('click', () => rememberItem('session', '本次约束', lines.map(([label, value]) => label + value).join('，')));
      remember.append(button);
    }
    if (state?.confirmed_product_id) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip-btn tap';
      button.id = 'remember-product';
      button.textContent = '记住已确认商品';
      const product = catalog.find(item => item.id === state.confirmed_product_id);
      button.addEventListener('click', () => rememberItem('session', '已确认商品', product ? product.name : state.confirmed_product_id));
      remember.append(button);
    }
    thread.append(remember);
  }
  if (pendingLabel) {
    const wait = document.createElement('p');
    wait.className = 'bubble assistant';
    wait.id = 'pending';
    wait.textContent = pendingLabel;
    thread.append(wait);
  }
  const suggest = $('#suggest');
  suggest.replaceChildren();
  for (const text of suggestions(state)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip-btn tap';
    button.textContent = text;
    button.addEventListener('click', () => send(text));
    suggest.append(button);
  }
  $('#message').placeholder = scene === 'copy' ? '例如：简洁一些，或缩短到 80 字' : '说说预算、尺寸或颜色';
  thread.lastElementChild?.scrollIntoView({block: 'end'});
}

async function refreshSessions() {
  const payload = await fetch('/api/sessions').then(response => response.json());
  sessionList = payload.sessions;
  favoriteList = payload.favorites || [];
  guideTone = payload.guide_tone;
  memoryBook = payload.memory || memoryBook;
  renderHome();
  renderSessions();
  renderSettings();
}

async function loadActive() {
  if (!sessionId) return;
  const response = await fetch('/api/session?session_id=' + encodeURIComponent(sessionId));
  if (!response.ok) return;
  active = await response.json();
  guideTone = active.guide_tone;
  renderChat();
}

async function openChat(id, from) {
  sessionId = id;
  show('chat', {back: from || 'home'});
  await loadActive();
}

async function openNew(from, nextScene) {
  if (nextScene) scene = nextScene;
  const reusable = sessionList.find(item => item.name === '新会话' && item.revision === 0);
  if (reusable) {
    await openChat(reusable.id, from);
    return;
  }
  const payload = await fetch('/api/sessions', {method: 'POST'}).then(response => response.json());
  sessionId = payload.session_id;
  active = payload;
  show('chat', {back: from || 'home'});
  await refreshSessions();
  renderChat();
}

async function ask(text) {
  scene = 'search';
  await openNew('home', 'search');
  await send(text);
}

async function post(pathname, body) {
  const response = await fetch(pathname, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({...body, session_id: sessionId, revision: active?.state?.revision || 0})
  });
  const payload = await response.json();
  if (!response.ok) {
    active = payload.state ? {...active, ...payload, messages: active?.messages || []} : active;
    await loadActive();
    return null;
  }
  active = payload;
  renderChat();
  await refreshSessions();
  return payload;
}

async function withPending(label, work) {
  pendingLabel = label;
  renderChat();
  try {
    return await work();
  } finally {
    pendingLabel = '';
    renderChat();
  }
}

async function rememberItem(scope, key, value) {
  const payload = await fetch('/api/memory', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'remember', scope, key, value, session_id: sessionId})
  }).then(response => response.json());
  guideTone = payload.guide_tone;
  memoryBook = payload.memory || memoryBook;
  if (active) active.memories = payload.memories;
  renderChat();
  renderSettings();
}

async function forgetMemory(id) {
  const payload = await fetch('/api/memory', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'delete', id, session_id: sessionId})
  }).then(response => response.json());
  guideTone = payload.guide_tone;
  memoryBook = payload.memory || memoryBook;
  renderSettings();
  if (screen === 'chat') await loadActive();
}

async function send(text) {
  const value = text.trim();
  if (!value || busy) return;
  busy = true;
  const input = $('#message');
  input.value = '';
  try {
    const payload = await post('/api/turn', {text: value});
    if (!payload && !input.value) input.value = value;
  } finally {
    busy = false;
  }
}

async function confirmProduct(productId) {
  await post('/api/confirm', {product_id: productId});
}

function openRename(id, current) {
  renameTarget = id;
  $('#rename-input').value = current || '';
  $('#rename-sheet').hidden = false;
  $('#rename-input').focus();
}

function closeRename() {
  renameTarget = null;
  $('#rename-sheet').hidden = true;
}

async function renameSession(id, name) {
  const response = await fetch('/api/session/name', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({session_id: id, name})
  });
  if (!response.ok) return;
  const payload = await response.json();
  if (sessionId === id) active = payload;
  await refreshSessions();
  if (screen === 'chat') renderChat();
}

async function toggleFavorite(sourceId, kind, title, content) {
  if (!sessionId && !favoriteList.some(item => item.source_id === sourceId)) return;
  const owner = favoriteList.find(item => item.source_id === sourceId)?.session_id || sessionId;
  await fetch('/api/favorites', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({session_id: owner, source_id: sourceId, kind, title, content})
  });
  await refreshSessions();
  if (screen === 'chat') renderChat();
}

async function resetSession(id) {
  await fetch('/api/reset', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({session_id: id})
  });
  if (sessionId === id && screen === 'chat') await loadActive();
  await refreshSessions();
}

$('#open-settings').addEventListener('click', () => { renderSettings(); show('settings', {back: screen}); });
$('#chat-settings').addEventListener('click', () => { renderSettings(); show('settings', {back: 'chat'}); });
$('#settings-back').addEventListener('click', () => show(backTo === 'settings' ? 'home' : backTo));
$('#chat-back').addEventListener('click', () => show(backTo));
$('#sessions-home').addEventListener('click', () => show('home'));
$('#rename-current').addEventListener('click', () => {
  if (sessionId) openRename(sessionId, active?.customer_name || '');
});
$('#rename-sheet').addEventListener('submit', async event => {
  event.preventDefault();
  const id = renameTarget;
  const name = $('#rename-input').value;
  closeRename();
  if (id) await renameSession(id, name);
});
$('#rename-clear').addEventListener('click', async () => {
  const id = renameTarget;
  closeRename();
  if (id) await renameSession(id, '');
});
$('#rename-cancel').addEventListener('click', closeRename);
$('#tab-recent').addEventListener('click', () => { hubTab = 'recent'; renderSessions(); });
$('#tab-favorites').addEventListener('click', () => { hubTab = 'favorites'; renderSessions(); });
$('#open-search').addEventListener('click', () => openNew('home', 'search'));
$('#open-copy').addEventListener('click', () => openNew('home', 'copy'));
$('#new-chat').addEventListener('click', () => openNew('sessions', 'search'));
$('#composer').addEventListener('submit', event => {
  event.preventDefault();
  send($('#message').value);
});
for (const button of document.querySelectorAll('[data-scene]')) {
  button.addEventListener('click', () => {
    scene = button.dataset.scene;
    renderChat();
  });
}
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => show(tab.dataset.screen));
}
for (const button of document.querySelectorAll('[data-tone]')) {
  button.addEventListener('click', async () => {
    const payload = await fetch('/api/memory', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({tone: button.dataset.tone})
    }).then(response => response.json());
    guideTone = payload.guide_tone;
    memoryBook = payload.memory || memoryBook;
    renderSettings();
  });
}
$('#forget-tone').addEventListener('click', async () => {
  const payload = await fetch('/api/memory', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'delete'})
  }).then(response => response.json());
  guideTone = payload.guide_tone;
  memoryBook = payload.memory || memoryBook;
  renderSettings();
});

model = await fetch('/api/model-status').then(response => response.json());
catalog = (await fetch('/api/catalog').then(response => response.json())).products;
show('home');
await refreshSessions();
