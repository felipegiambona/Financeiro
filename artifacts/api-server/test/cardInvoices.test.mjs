import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAvailableLimit,
  getCardInvoiceSummaries,
  invoiceMonthForPurchase,
} from "../src/services/cardInvoices.ts";

test("assigns purchases after closing to the following invoice month", () => {
  assert.equal(invoiceMonthForPurchase("2026-09-10", 10), "2026-09");
  assert.equal(invoiceMonthForPurchase("2026-09-11", 10), "2026-10");
});

test("marks a closed current invoice and an unpaid past invoice correctly", () => {
  const rows = [
    { date: "2026-08-05", amount: "120", cardEntryType: "purchase" },
    { date: "2026-09-03", amount: "80", cardEntryType: "purchase" },
  ];
  const invoices = getCardInvoiceSummaries(rows, 10, 20, new Date(2026, 8, 15, 12));

  assert.equal(invoices.find((invoice) => invoice.invoiceMonth === "2026-08")?.status, "overdue");
  assert.equal(invoices.find((invoice) => invoice.invoiceMonth === "2026-09")?.status, "closed");
});

test("marks a paid invoice by its explicit competence without changing the balance twice", () => {
  const rows = [
    { date: "2026-08-05", amount: "120", cardEntryType: "purchase", cardInvoiceMonth: "2026-08" },
    { date: "2026-09-15", amount: "120", cardEntryType: "invoice_payment", cardInvoiceMonth: "2026-08" },
  ];
  const invoices = getCardInvoiceSummaries(rows, 10, 20, new Date(2026, 8, 15, 12));
  const invoice = invoices.find((item) => item.invoiceMonth === "2026-08");

  assert.equal(invoice?.status, "paid");
  assert.equal(invoice?.amount, 120);
});

test("uses the Sao Paulo calendar date before closing the current invoice", () => {
  const rows = [
    { date: "2026-09-03", amount: "80", cardEntryType: "purchase" },
  ];
  const invoices = getCardInvoiceSummaries(rows, 15, 20, new Date("2026-09-15T01:00:00.000Z"));
  const invoice = invoices.find((item) => item.invoiceMonth === "2026-09");

  assert.equal(invoice?.status, "open");
});

test("reduces the available limit for unpaid invoices, including overdue invoices", () => {
  assert.equal(calculateAvailableLimit(2000, [
    { invoiceMonth: "2026-08", amount: 120, status: "overdue" },
    { invoiceMonth: "2026-09", amount: 80, status: "closed" },
    { invoiceMonth: "2026-07", amount: 50, status: "paid" },
  ]), 1800);
});