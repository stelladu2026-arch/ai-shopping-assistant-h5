import assert from 'node:assert/strict';
import { storeDate } from '../server/date.mjs';
import { buildPromoPlan } from '../lib/guide/promos.ts';
assert.equal(storeDate(new Date('2027-12-31T16:00:00Z')), '2028-01-01');
assert.equal(storeDate(new Date('2027-12-31T15:59:59Z')), '2027-12-31');
assert.ok(buildPromoPlan('S01', '2026-10-20').use.length > 0);
assert.equal(buildPromoPlan('S01', '2028-01-01').use.length, 0);
assert.equal(buildPromoPlan('S01', '2025-12-31').use.length, 0);
console.log('ok promotion dates: Shanghai midnight, future and expired promotions');
