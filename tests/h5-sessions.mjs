import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

process.env.GUIDE_SQLITE_FILE = path.join(mkdtempSync(path.join(tmpdir(), 'guide-h5-')), 'guide.sqlite');
const {start} = await import('../server/index.mjs');
const store = await import('../server/store.mjs');

const server = await start(0);
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;

async function read(url, options) {
  const response = await fetch(base + url, options);
  const body = await response.json();
  return {status: response.status, body};
}

const empty = await read('/api/sessions');
assert.equal(empty.status, 200);
assert.deepEqual(empty.body.sessions, []);
assert.equal(JSON.stringify(empty.body).includes('小陈'), false);
assert.equal(JSON.stringify(empty.body).includes('林女士'), false);

const missing = await read('/api/session?session_id=guest-a');
assert.equal(missing.status, 404);
const stillEmpty = await read('/api/sessions');
assert.deepEqual(stillEmpty.body.sessions, []);

const created = await read('/api/sessions', {method: 'POST'});
const id = created.body.session_id;
assert.equal(created.body.title, '新会话');
const turned = await read('/api/turn', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: id, text: '只看餐桌，预算3000元', revision: 0})
});
assert.equal(turned.status, 200);
assert.equal(turned.body.title, '只看餐桌，预算3000元');

const other = await read('/api/sessions', {method: 'POST'});
const otherTurn = await read('/api/turn', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: other.body.session_id, text: '只看沙发，预算2000元', revision: 0})
});
assert.equal(otherTurn.body.state.constraints.category, '沙发');
const first = await read('/api/session?session_id=' + id);
assert.equal(first.body.state.constraints.category, '餐桌');
assert.equal(first.body.title, '只看餐桌，预算3000元');

const list = await read('/api/sessions');
assert.deepEqual(list.body.sessions.map(item => item.name).sort(), ['只看沙发，预算2000元', '只看餐桌，预算3000元']);
assert.equal(list.body.sessions.every(item => item.customer_name === ''), true);

const renamed = await read('/api/session/name', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: id, name: '  林女士  '})
});
assert.equal(renamed.body.title, '林女士');
assert.equal(renamed.body.customer_name, '林女士');
const followed = await read('/api/turn', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: id, text: '便宜点', revision: turned.body.state.revision})
});
assert.equal(followed.body.title, '林女士');
const cleared = await read('/api/session/name', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: id, name: ''})
});
assert.equal(cleared.body.title, '只看餐桌，预算3000元');
assert.equal(cleared.body.customer_name, '');

const current = await read('/api/session?session_id=' + id);
const productId = current.body.state.candidate_ids[0];
const confirmed = await read('/api/confirm', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: id, product_id: productId, revision: current.body.state.revision})
});
assert.equal(confirmed.status, 200);
const keptId = confirmed.body.state.confirmed_product_id;
const policy = await read('/api/turn', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: id, text: '沙发质保多久', revision: confirmed.body.state.revision})
});
assert.equal(policy.status, 200);
assert.equal(policy.body.state.confirmed_product_id, keptId);
assert.equal(policy.body.state.constraints.category, '餐桌');
assert.match(policy.body.reply, /终身保修/);
assert.equal(policy.body.state.candidate_ids.some(item => String(item).startsWith('S')), false);

const saved = await read('/api/favorites', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: id, source_id: 'product:' + keptId, kind: 'product', title: '原木餐桌', content: '已确认的餐桌'})
});
assert.equal(saved.body.favorites.some(item => item.title === '原木餐桌'), true);

store.saveSession('sess_next', {
  state: createStateSafe(),
  messages: [],
  customerName: '小陈',
  transcript: {title: '小陈', sceneMode: 'moments_marketing', messagesMoments: [{role: 'user', text: '想看床'}], messagesRag: []},
  updatedAt: Date.now()
});
const shared = await read('/api/sessions');
assert.equal(shared.body.sessions.some(item => item.name === '小陈'), true);
assert.equal(shared.body.favorites.some(item => item.title === '原木餐桌'), true);

const editSession = await read('/api/sessions', {method: 'POST'});
const editId = editSession.body.session_id;
const namedEdit = await read('/api/session/name', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: editId, name: '周先生'})
});
assert.equal(namedEdit.body.customer_name, '周先生');
const sofa = await read('/api/turn', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: editId, text: '只看沙发，预算3000元，不要皮质', revision: 0})
});
assert.equal(sofa.body.state.constraints.budget_max_cny, 3000);
assert.equal(sofa.body.state.constraints.exclude_material, '皮质');
assert.equal(sofa.body.state.candidate_ids.includes('S04'), false);
assert.equal(sofa.body.title, '周先生');
const raised = await read('/api/constraint', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: editId, field: 'budget_max_cny', value: 5000, revision: sofa.body.state.revision})
});
assert.equal(raised.status, 200);
assert.equal(raised.body.state.constraints.budget_max_cny, 5000);
assert.equal(raised.body.state.constraints.exclude_material, '皮质');
assert.equal(raised.body.state.candidate_ids.includes('S04'), true);
assert.equal(raised.body.state.candidate_ids.includes('S03'), false);
assert.equal(raised.body.customer_name, '周先生');
assert.equal(raised.body.title, '周先生');
assert.equal(raised.body.messages.some(item => item.text === '预算 5000元'), true);
const dropped = await read('/api/constraint', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: editId, field: 'exclude_material', clear: true, revision: raised.body.state.revision})
});
assert.equal(dropped.body.state.constraints.exclude_material, null);
assert.equal(dropped.body.state.constraints.budget_max_cny, 5000);
assert.equal(dropped.body.state.candidate_ids.includes('S03'), true);
assert.equal(dropped.body.customer_name, '周先生');
assert.equal(dropped.body.messages.some(item => item.text === '去掉不要 皮质'), true);
const spoken = JSON.stringify(dropped.body.messages);
assert.equal(spoken.includes('必须满足'), false);
assert.equal(spoken.includes('优先满足'), false);
assert.equal(spoken.includes('去除条件'), false);
assert.equal(spoken.includes('排除材质'), false);
const narrowed = await read('/api/turn', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: editId, text: '宽度改成160', revision: dropped.body.state.revision})
});
assert.equal(narrowed.body.state.constraints.width_max_cm, 160);
assert.equal(narrowed.body.state.constraints.budget_max_cny, 5000);
assert.equal(narrowed.body.state.candidate_ids.includes('S02'), true);
assert.equal(narrowed.body.state.candidate_ids.includes('S01'), false);
assert.equal(narrowed.body.customer_name, '周先生');

server.close();
const restarted = await start(0);
const again = await fetch('http://127.0.0.1:' + restarted.address().port + '/api/sessions').then(response => response.json());
assert.equal(again.sessions.some(item => item.id === id), true);
assert.equal(again.sessions.some(item => item.name === '小陈'), true);
assert.equal(again.favorites.some(item => item.title === '原木餐桌'), true);
restarted.close();
console.log('ok h5 sessions');

function createStateSafe() {
  return {
    revision: 0,
    constraints: {budget_max_cny: null, width_max_cm: null, category: null, color: null, exclude_material: null},
    candidate_ids: [],
    confirmed_product_id: null,
    confirmed_product_version: null,
    pending_question: null,
    card: null,
    copy_requirement: null
  };
}
