import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import express from "express";
import http from "node:http";
import {
  calculateAvailableLimit,
  getCardInvoiceSummaries,
  invoiceMonthForPurchase,
} from "../src/services/cardInvoices.ts";
import { createCardsRouter } from "../src/routes/cards.ts";
import {
  CreateCardResponse,
  GetCardResponse,
  ListCardsResponse,
  PayCardInvoiceResponse,
  UpdateCardResponse,
} from "@workspace/api-zod";
import {
  cardsTable,
  transactionsTable,
} from "@workspace/db";

const USER_ID = "user-1::profile-1";
const PROFILE_ID = "profile-1";
const CARD_ID = "00000000-0000-0000-0000-000000000001";
const WALLET_ID = "00000000-0000-0000-0000-000000000010";
const CREATED_AT = new Date("2026-01-01T12:00:00.000Z");

function matches(row, condition) {
  if (!condition) return true;
  if (condition.kind === "and") return condition.conditions.every((item) => matches(row, item));
  if (condition.kind === "eq") return row[condition.column.name] === condition.value;
  return true;
}

class InMemoryDatabase {
  constructor(cards, transactions) {
    this.rows = new Map([
      [cardsTable.name, cards],
      [transactionsTable.name, transactions],
    ]);
    this.nextCardId = 2;
  }

  select() {
    const database = this;
    return {
      from(table) {
        let condition;
        let ordering;
        return {
          where(nextCondition) {
            condition = nextCondition;
            return this;
          },
          orderBy(nextOrdering) {
            ordering = nextOrdering;
            return this;
          },
          then(resolve, reject) {
            let rows = [...(database.rows.get(table.name) ?? [])].filter((row) => matches(row, condition));
            if (ordering?.kind === "asc") {
              rows.sort((left, right) => left[ordering.column.name] - right[ordering.column.name]);
            }
            return Promise.resolve(rows).then(resolve, reject);
          },
        };
      },
    };
  }

  insert(table) {
    const database = this;
    return {
      values(values) {
        const execute = () => {
          const now = new Date("2026-09-15T12:00:00.000Z");
          const row = {
            ...values,
            id: values.id ?? (table.name === cardsTable.name
              ? `00000000-0000-0000-0000-00000000000${database.nextCardId++}`
              : `00000000-0000-0000-0000-000000000099`),
            createdAt: values.createdAt ?? now,
            updatedAt: values.updatedAt ?? now,
          };
          database.rows.get(table.name).push(row);
          return [row];
        };
        return {
          returning() {
            return Promise.resolve(execute());
          },
          then(resolve, reject) {
            return Promise.resolve(execute()).then(resolve, reject);
          },
        };
      },
    };
  }

  update(table) {
    const database = this;
    return {
      set(updates) {
        let condition;
        return {
          where(nextCondition) {
            condition = nextCondition;
            return this;
          },
          returning() {
            const rows = database.rows.get(table.name);
            const row = rows.find((candidate) => matches(candidate, condition));
            if (!row) return Promise.resolve([]);
            Object.assign(row, updates, { updatedAt: new Date("2026-09-15T12:00:00.000Z") });
            return Promise.resolve([row]);
          },
        };
      },
    };
  }
}

function fixtureDatabase() {
  return new InMemoryDatabase(
    [{
      id: CARD_ID,
      userId: USER_ID,
      profileId: PROFILE_ID,
      name: "Cartão principal",
      dueDay: 25,
      closingDay: 20,
      currentInvoiceAmount: "0",
      availableLimit: "1000",
      invoiceStatus: "open",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    }],
    [
      {
        id: "00000000-0000-0000-0000-000000000011",
        userId: USER_ID,
        cardId: CARD_ID,
        cardEntryType: "purchase",
        cardInvoiceMonth: "2026-07",
        type: "expense",
        amount: "50",
        date: "2026-07-05",
      },
      {
        id: "00000000-0000-0000-0000-000000000012",
        userId: USER_ID,
        cardId: CARD_ID,
        cardEntryType: "invoice_payment",
        cardInvoiceMonth: "2026-07",
        type: "expense",
        amount: "50",
        date: "2026-07-15",
      },
      {
        id: "00000000-0000-0000-0000-000000000013",
        userId: USER_ID,
        cardId: CARD_ID,
        cardEntryType: "purchase",
        cardInvoiceMonth: "2026-08",
        type: "expense",
        amount: "120",
        date: "2026-08-05",
      },
      {
        id: "00000000-0000-0000-0000-000000000014",
        userId: USER_ID,
        cardId: CARD_ID,
        cardEntryType: "purchase",
        cardInvoiceMonth: "2026-09",
        type: "expense",
        amount: "80",
        date: "2026-09-05",
      },
    ],
  );
}

let server;
let port;
let database;

function request(path, { method = "GET", body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            body: responseBody ? JSON.parse(responseBody) : undefined,
          });
        });
      },
    );
    request.on("error", reject);
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

function assertCompleteCardResponse(schema, body) {
  const parsed = schema.parse(body);
  const cards = Array.isArray(parsed) ? parsed : [parsed];
  for (const card of cards) {
    assert.ok(Array.isArray(card.invoices));
    assert.ok(Array.isArray(card.overdueInvoices));
  }
  return parsed;
}

before(async () => {
  database = fixtureDatabase();
  const app = express();
  app.use(express.json());
  app.use(createCardsRouter({
    database,
    authenticate: (_req, _res, next) => next(),
    resolveProfile: (req, _res, next) => {
      req.scopedUserId = USER_ID;
      req.profileId = PROFILE_ID;
      next();
    },
    ensureWallet: async () => ({ id: WALLET_ID }),
    now: () => new Date("2026-09-15T12:00:00-03:00"),
  }));
  server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => resolve(listeningServer));
  });
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

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

test("recalculates invoice months, dates, and statuses after updating card closing and due days", async () => {
  const createResponse = await request("/cards", {
    method: "POST",
    body: { name: "Cartão perto do fechamento", dueDay: 25, closingDay: 20, availableLimit: 1000 },
  });
  assert.equal(createResponse.status, 201);
  const createdCard = assertCompleteCardResponse(CreateCardResponse, createResponse.body);

  database.rows.get(transactionsTable.name).push(
    {
      id: "00000000-0000-0000-0000-000000000021",
      userId: USER_ID,
      cardId: createdCard.id,
      cardEntryType: "purchase",
      type: "expense",
      amount: "120",
      date: "2026-08-05",
    },
    {
      id: "00000000-0000-0000-0000-000000000022",
      userId: USER_ID,
      cardId: createdCard.id,
      cardEntryType: "purchase",
      type: "expense",
      amount: "80",
      date: "2026-09-19",
    },
  );

  const beforeUpdateResponse = await request(`/cards/${createdCard.id}`);
  assert.equal(beforeUpdateResponse.status, 200);
  const beforeUpdate = assertCompleteCardResponse(GetCardResponse, beforeUpdateResponse.body);
  assert.equal(beforeUpdate.invoices.find((invoice) => invoice.invoiceMonth === "2026-09")?.amount, 80);
  assert.equal(beforeUpdate.invoices.find((invoice) => invoice.invoiceMonth === "2026-10"), undefined);

  const updateResponse = await request(`/cards/${createdCard.id}`, {
    method: "PATCH",
    body: { closingDay: 15, dueDay: 10 },
  });
  assert.equal(updateResponse.status, 200);
  const updatedCard = assertCompleteCardResponse(UpdateCardResponse, updateResponse.body);

  assert.equal(updatedCard.closingDay, 15);
  assert.equal(updatedCard.dueDay, 10);
  assert.deepEqual(
    updatedCard.invoices.map((invoice) => [
      invoice.invoiceMonth,
      invoice.amount,
      invoice.status,
      invoice.dueDate.toISOString().slice(0, 10),
      invoice.closingDate.toISOString().slice(0, 10),
    ]),
    [
      ["2026-08", 120, "overdue", "2026-08-10", "2026-08-15"],
      ["2026-09", 0, "open", "2026-09-10", "2026-09-15"],
      ["2026-10", 80, "open", "2026-10-10", "2026-10-15"],
    ],
  );
  assert.deepEqual(updatedCard.overdueInvoices.map((invoice) => invoice.invoiceMonth), ["2026-08"]);
  assert.equal(updatedCard.invoices.find((invoice) => invoice.invoiceMonth === "2026-08")?.status, "overdue");
  assert.equal(updatedCard.invoices.find((invoice) => invoice.invoiceMonth === "2026-10")?.status, "open");
});

test("validates complete invoice payloads on every card HTTP endpoint", async () => {
  const listResponse = await request("/cards");
  assert.equal(listResponse.status, 200);
  const listedCards = assertCompleteCardResponse(ListCardsResponse, listResponse.body);
  const listedCard = listedCards.find((card) => card.id === CARD_ID);
  assert.ok(listedCard);
  assert.deepEqual(
    listedCard.invoices.map((invoice) => [invoice.invoiceMonth, invoice.status]),
    [["2026-07", "paid"], ["2026-08", "overdue"], ["2026-09", "open"]],
  );
  assert.deepEqual(listedCard.overdueInvoices.map((invoice) => invoice.invoiceMonth), ["2026-08"]);

  assert.throws(() => ListCardsResponse.parse([{
    ...listResponse.body[0],
    overdueInvoices: undefined,
  }]));

  const getResponse = await request(`/cards/${CARD_ID}`);
  assert.equal(getResponse.status, 200);
  const fetchedCard = assertCompleteCardResponse(GetCardResponse, getResponse.body);
  assert.equal(fetchedCard.invoices.find((invoice) => invoice.invoiceMonth === "2026-08")?.status, "overdue");

  const updateResponse = await request(`/cards/${CARD_ID}`, {
    method: "PATCH",
    body: { name: "Cartão atualizado" },
  });
  assert.equal(updateResponse.status, 200);
  const updatedCard = assertCompleteCardResponse(UpdateCardResponse, updateResponse.body);
  assert.equal(updatedCard.name, "Cartão atualizado");
  assert.equal(updatedCard.invoices.find((invoice) => invoice.invoiceMonth === "2026-07")?.status, "paid");

  const payResponse = await request(`/cards/${CARD_ID}/pay-invoice`, {
    method: "POST",
    body: { invoiceMonth: "2026-09" },
  });
  assert.equal(payResponse.status, 200);
  const paidCard = assertCompleteCardResponse(PayCardInvoiceResponse, payResponse.body);
  assert.equal(paidCard.invoices.find((invoice) => invoice.invoiceMonth === "2026-09")?.status, "paid");
  assert.equal(paidCard.invoices.find((invoice) => invoice.invoiceMonth === "2026-08")?.status, "overdue");

  const createResponse = await request("/cards", {
    method: "POST",
    body: { name: "Novo cartão", dueDay: 10, closingDay: 5, availableLimit: 500 },
  });
  assert.equal(createResponse.status, 201);
  const createdCard = assertCompleteCardResponse(CreateCardResponse, createResponse.body);
  assert.deepEqual(createdCard.invoices.map((invoice) => [invoice.invoiceMonth, invoice.amount, invoice.status]), [
    ["2026-09", 0, "open"],
  ]);
  assert.deepEqual(createdCard.overdueInvoices, []);
});
