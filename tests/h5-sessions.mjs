import assert from 'node:assert/strict';
import {start} from '../server/index.mjs';

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

server.close();
console.log('ok h5 sessions');
