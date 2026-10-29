import assert from "node:assert/strict";
import test from "node:test";
import { fetchHistory } from "../bot/lib/market.ts";

function dateAt(index: number): string {
  return new Date(Date.UTC(2020, 0, 1) + index * 86_400_000).toISOString().slice(0, 10);
}

function page(start: number, count: number) {
  const rows = [];
  for (let offset = 0; offset < count; offset += 1) {
    rows.push({
      FSRQ: dateAt(start + offset),
      DWJZ: "1.2500",
      LJJZ: "2.5000",
      SGZT: "开放申购",
      SHZT: "开放赎回",
    });
  }
  return { ErrCode: 0, Data: { LSJZList: rows } };
}

test("history keeps paging while each page is full", async () => {
  let calls = 0;
  const history = await fetchHistory("110022", {
    fetchPage: async (pageNumber) => {
      calls += 1;
      return page((pageNumber - 1) * 20, 20);
    },
  });
  assert.equal(calls, 40);
  assert.equal(history.points.length, 800);
  assert.equal(history.points[0].date < history.points[799].date, true);
  assert.equal(history.latestAccumulated, 2.5);
  assert.equal(history.subscribeStatus, "开放申购");
});

test("history stops when a page is short", async () => {
  const seen: number[] = [];
  const history = await fetchHistory("110022", {
    fetchPage: async (pageNumber) => {
      seen.push(pageNumber);
      return page((pageNumber - 1) * 20, pageNumber === 3 ? 5 : 20);
    },
  });
  assert.deepEqual(seen, [1, 2, 3]);
  assert.equal(history.points.length, 45);
});
