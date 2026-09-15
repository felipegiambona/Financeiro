import assert from "node:assert/strict";
import test from "node:test";
import { parseBrapiDividendEvents } from "../src/lib/investmentDividendCalendar.ts";

const investment = {
  id: "investment-1",
  name: "Petrobras PN",
  ticker: "PETR4",
  quantity: "10",
};

test("parses future dividends and JCP as portfolio totals", () => {
  const events = parseBrapiDividendEvents(investment, {
    results: [{
      dividendsData: {
        cashDividends: [
          { paymentDate: "2026-12-21T03:00:00.000Z", rate: 0.471567, label: "DIVIDENDO" },
          { paymentDate: "2026-12-21T03:00:00.000Z", rate: 0.202504, label: "JCP" },
        ],
      },
    }],
  }, "2026-09-15");

  assert.deepEqual(events.map((event) => ({
    type: event.type,
    amount: event.amount,
    paymentDate: event.paymentDate,
  })), [
    { type: "dividend", amount: 4.72, paymentDate: "2026-12-21" },
    { type: "jcp", amount: 2.03, paymentDate: "2026-12-21" },
  ]);
});

test("ignores past events, unknown labels, and assets without quantity", () => {
  const payload = {
    results: [{
      dividendsData: {
        cashDividends: [
          { paymentDate: "2026-09-14", rate: 1, label: "DIVIDENDO" },
          { paymentDate: "2026-12-21", rate: 1, label: "BONIFICAÇÃO" },
        ],
      },
    }],
  };

  assert.deepEqual(parseBrapiDividendEvents(investment, payload, "2026-09-15"), []);
  assert.deepEqual(parseBrapiDividendEvents({ ...investment, quantity: 0 }, payload, "2026-09-15"), []);
});