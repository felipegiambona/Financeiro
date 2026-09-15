import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAvailableLimit,
  getCardInvoiceSummaries,
  invoiceMonthForPurchase,
} from "../src/services/cardInvoices.ts";
import { ListCardsResponse } from "@workspace/api-zod";

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

test("accepts the invoice fields and statuses returned by the cards API", () => {
  const [card] = ListCardsResponse.parse([{
    id: "00000000-0000-0000-0000-000000000001",
    name: "Cartão principal",
    dueDay: 10,
    closingDay: 20,
    currentInvoiceAmount: 120,
    availableLimit: 1880,
    invoiceStatus: "overdue",
    invoices: [
      {
        invoiceMonth: "2026-08",
        amount: 120,
        status: "paid",
        dueDate: "2026-08-10",
        closingDate: "2026-07-20",
      },
      {
        invoiceMonth: "2026-09",
        amount: 80,
        status: "overdue",
        dueDate: "2026-09-10",
        closingDate: "2026-08-20",
      },
    ],
    overdueInvoices: [{
      invoiceMonth: "2026-09",
      amount: 80,
      status: "overdue",
      dueDate: "2026-09-10",
      closingDate: "2026-08-20",
    }],
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-09-15T12:00:00.000Z",
  }]);

  assert.equal(card.invoices.length, 2);
  assert.equal(card.invoices[0].status, "paid");
  assert.equal(card.overdueInvoices[0].status, "overdue");
  assert.ok(card.invoices[0].dueDate instanceof Date);
});
