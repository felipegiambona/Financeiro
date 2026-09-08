import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";

const clerkApiUrl = "https://api.clerk.com/v1";
const apiUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8080/api";
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

const temporaryIdentities = [];

function requireTestConfiguration() {
  assert.ok(
    clerkSecretKey,
    "CLERK_SECRET_KEY is required to run authenticated integration tests",
  );
}

async function clerkRequest(path, options = {}) {
  const response = await fetch(`${clerkApiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new Error(
      `Clerk request ${options.method ?? "GET"} ${path} failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function apiRequest(token, path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

async function createTemporaryIdentity(label) {
  const user = await clerkRequest("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [
        `iso-${label}-${randomUUID()}@example.com`,
      ],
      password: `Isolation-${randomUUID()}-x9!`,
      skip_password_checks: true,
    }),
  });
  temporaryIdentities.push({ userId: user.id });

  const session = await clerkRequest("/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: user.id }),
  });
  temporaryIdentities.at(-1).sessionId = session.id;

  const token = await clerkRequest(`/sessions/${session.id}/tokens`, {
    method: "POST",
  });

  assert.equal(typeof token.jwt, "string");
  assert.ok(token.jwt.length > 0);

  return { token: token.jwt };
}

function transactionInput(description) {
  return {
    type: "expense",
    amount: 42.5,
    description,
    date: "2026-09-08",
    dueDate: "2026-09-08",
    recurrence: { kind: "none" },
    paymentStatus: "unpaid",
  };
}

function assertStatus(result, expectedStatus) {
  assert.equal(
    result.status,
    expectedStatus,
    JSON.stringify(result.body, null, 2),
  );
}

async function clearIdentityData(identity) {
  if (!identity?.token) {
    return;
  }

  const result = await apiRequest(identity.token, "/transactions", {
    method: "DELETE",
  });
  assertStatus(result, 204);
}

describe("transaction account isolation", () => {
  let accountA;
  let accountB;

  before(() => {
    requireTestConfiguration();
  });

  after(async () => {
    const cleanupErrors = [];

    for (const identity of [accountA, accountB]) {
      try {
        await clearIdentityData(identity);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    for (const identity of temporaryIdentities) {
      if (identity.sessionId) {
        try {
          await clerkRequest(`/sessions/${identity.sessionId}/revoke`, {
            method: "POST",
          });
        } catch (error) {
          cleanupErrors.push(error);
        }
      }

      try {
        await clerkRequest(`/users/${identity.userId}`, { method: "DELETE" });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Temporary test data cleanup failed");
    }
  });

  it("keeps every transaction operation scoped to its Clerk identity", async () => {
    accountA = await createTemporaryIdentity("account-a");
    accountB = await createTemporaryIdentity("account-b");

    const accountADescription = `account-a-${randomUUID()}`;
    const accountABatchDescription = `account-a-batch-${randomUUID()}`;
    const accountAClearDescription = `account-a-clear-${randomUUID()}`;
    const accountBDescription = `account-b-${randomUUID()}`;

    const createdA = await apiRequest(accountA.token, "/transactions", {
      method: "POST",
      body: transactionInput(accountADescription),
    });
    assertStatus(createdA, 201);

    const createdABatch = await apiRequest(accountA.token, "/transactions", {
      method: "POST",
      body: transactionInput(accountABatchDescription),
    });
    assertStatus(createdABatch, 201);

    const createdAClear = await apiRequest(accountA.token, "/transactions", {
      method: "POST",
      body: transactionInput(accountAClearDescription),
    });
    assertStatus(createdAClear, 201);

    const createdB = await apiRequest(accountB.token, "/transactions", {
      method: "POST",
      body: transactionInput(accountBDescription),
    });
    assertStatus(createdB, 201);

    const accountAId = createdA.body.id;
    const accountABatchId = createdABatch.body.id;
    const accountAClearId = createdAClear.body.id;
    const accountBId = createdB.body.id;

    const accountBList = await apiRequest(accountB.token, "/transactions");
    assertStatus(accountBList, 200);
    assert.deepEqual(
      accountBList.body.map((transaction) => transaction.description),
      [accountBDescription],
    );

    const crossAccountUpdate = await apiRequest(
      accountB.token,
      `/transactions/${accountAId}`,
      {
        method: "PATCH",
        body: { description: "account-b-must-not-edit-account-a" },
      },
    );
    assertStatus(crossAccountUpdate, 404);

    const crossAccountOccurrenceUpdate = await apiRequest(
      accountB.token,
      `/transactions/${accountAId}/occurrences/2026-09-08/payment-status`,
      {
        method: "PATCH",
        body: { paymentStatus: "paid" },
      },
    );
    assertStatus(crossAccountOccurrenceUpdate, 404);

    const crossAccountDelete = await apiRequest(
      accountB.token,
      `/transactions/${accountAId}`,
      { method: "DELETE" },
    );
    assertStatus(crossAccountDelete, 404);

    const accountAAfterCrossAccountAttempts = await apiRequest(
      accountA.token,
      "/transactions",
    );
    assertStatus(accountAAfterCrossAccountAttempts, 200);
    const accountAPrimaryBeforeOwnerUpdate =
      accountAAfterCrossAccountAttempts.body.find(
        (transaction) => transaction.id === accountAId,
      );
    assert.equal(accountAPrimaryBeforeOwnerUpdate.description, accountADescription);
    assert.deepEqual(accountAPrimaryBeforeOwnerUpdate.paymentStatusOverrides, {});

    const mixedBatchDelete = await apiRequest(
      accountB.token,
      "/transactions/batch-delete",
      {
        method: "POST",
        body: { ids: [accountABatchId, accountBId] },
      },
    );
    assertStatus(mixedBatchDelete, 204);

    const accountBAfterBatchDelete = await apiRequest(
      accountB.token,
      "/transactions",
    );
    assertStatus(accountBAfterBatchDelete, 200);
    assert.deepEqual(accountBAfterBatchDelete.body, []);

    const accountAAfterMixedBatchDelete = await apiRequest(
      accountA.token,
      "/transactions",
    );
    assertStatus(accountAAfterMixedBatchDelete, 200);
    assert.deepEqual(
      accountAAfterMixedBatchDelete.body.map((transaction) => transaction.id),
      [accountAClearId, accountABatchId, accountAId],
    );

    const ownerOccurrenceUpdate = await apiRequest(
      accountA.token,
      `/transactions/${accountAId}/occurrences/2026-09-08/payment-status`,
      {
        method: "PATCH",
        body: { paymentStatus: "paid" },
      },
    );
    assertStatus(ownerOccurrenceUpdate, 200);
    assert.equal(
      ownerOccurrenceUpdate.body.paymentStatusOverrides["2026-09-08"],
      "paid",
    );

    const ownerUpdate = await apiRequest(
      accountA.token,
      `/transactions/${accountAId}`,
      {
        method: "PATCH",
        body: { amount: 99.99, description: "account-a-updated" },
      },
    );
    assertStatus(ownerUpdate, 200);
    assert.equal(ownerUpdate.body.amount, 99.99);
    assert.equal(ownerUpdate.body.description, "account-a-updated");

    const accountBClear = await apiRequest(
      accountB.token,
      "/transactions",
      { method: "DELETE" },
    );
    assertStatus(accountBClear, 204);

    const accountAAfterAccountBClear = await apiRequest(
      accountA.token,
      "/transactions",
    );
    assertStatus(accountAAfterAccountBClear, 200);
    assert.deepEqual(
      accountAAfterAccountBClear.body.map((transaction) => transaction.id),
      [accountAClearId, accountABatchId, accountAId],
    );

    const ownerDelete = await apiRequest(
      accountA.token,
      `/transactions/${accountAId}`,
      { method: "DELETE" },
    );
    assertStatus(ownerDelete, 204);

    const accountAClear = await apiRequest(
      accountA.token,
      "/transactions",
      { method: "DELETE" },
    );
    assertStatus(accountAClear, 204);

    const accountAAfterClear = await apiRequest(
      accountA.token,
      "/transactions",
    );
    assertStatus(accountAAfterClear, 200);
    assert.deepEqual(accountAAfterClear.body, []);
  });
});