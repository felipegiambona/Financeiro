import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const clerkApiUrl = "https://api.clerk.com/v1";
const apiUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:8080/api";
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const execFileAsync = promisify(execFile);
let financialTables = [];

const temporaryIdentities = [];

async function requireTestConfiguration() {
  assert.ok(
    clerkSecretKey,
    "CLERK_SECRET_KEY is required to run authenticated integration tests",
  );
  assert.ok(
    process.env.DATABASE_URL,
    "DATABASE_URL is required to prepare legacy financial rows",
  );
  financialTables = (await runDatabaseQuery(
    "SELECT tablename FROM pg_catalog.pg_tables " +
      "WHERE schemaname = 'public' AND tablename LIKE 'finance_%' " +
      "AND tablename <> 'financial_profiles' ORDER BY tablename;",
  ))
    .split(/\r?\n/)
    .map((table) => table.trim())
    .filter(Boolean);
  assert.ok(
    financialTables.length > 0,
    "Expected at least one profile-scoped financial table",
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
  const identity = { userId: user.id };
  temporaryIdentities.push(identity);

  const session = await clerkRequest("/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: user.id }),
  });
  identity.sessionId = session.id;

  const token = await clerkRequest(`/sessions/${session.id}/tokens`, {
    method: "POST",
  });

  assert.equal(typeof token.jwt, "string");
  assert.ok(token.jwt.length > 0);

  identity.token = token.jwt;
  return identity;
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

function profileRequest(token, profileId, path, options = {}) {
  return apiRequest(token, path, {
    ...options,
    headers: {
      "x-financial-profile-id": profileId,
      ...options.headers,
    },
  });
}

async function createFinancialFixture(token, profileId, label) {
  const wallet = await profileRequest(token, profileId, "/wallets", {
    method: "POST",
    body: {
      title: `${label} wallet`,
      initialBalance: 1000,
      icon: "wallet-outline",
    },
  });
  assertStatus(wallet, 201);

  const category = await profileRequest(token, profileId, "/categories", {
    method: "POST",
    body: {
      name: `${label} category`,
      color: "#72A17D",
    },
  });
  assertStatus(category, 201);

  const limit = await profileRequest(token, profileId, "/limits", {
    method: "POST",
    body: {
      categoryId: category.body.id,
      description: `${label} limit`,
      amount: 250,
      period: "monthly",
    },
  });
  assertStatus(limit, 201);

  const goal = await profileRequest(token, profileId, "/goals", {
    method: "POST",
    body: {
      title: `${label} goal`,
      targetAmount: 500,
      deadline: "2026-12-31",
    },
  });
  assertStatus(goal, 201);

  const movement = await profileRequest(token, profileId, `/goals/${goal.body.id}/movements`, {
    method: "POST",
    body: {
      type: "contribution",
      amount: 50,
      description: `${label} contribution`,
      date: "2026-09-08",
    },
  });
  assertStatus(movement, 201);

  const card = await profileRequest(token, profileId, "/cards", {
    method: "POST",
    body: {
      name: `${label} card`,
      dueDay: 10,
      closingDay: 5,
      availableLimit: 2000,
    },
  });
  assertStatus(card, 201);

  const transaction = await profileRequest(token, profileId, "/transactions", {
    method: "POST",
    body: {
      ...transactionInput(`${label} transaction`),
      walletId: wallet.body.id,
      cardId: card.body.id,
      categoryId: category.body.id,
      goalId: goal.body.id,
      paymentStatus: "paid",
    },
  });
  assertStatus(transaction, 201);

  return {
    walletId: wallet.body.id,
    categoryId: category.body.id,
    limitId: limit.body.id,
    goalId: goal.body.id,
    movementId: movement.body.id,
    cardId: card.body.id,
    transactionId: transaction.body.id,
  };
}

async function readFinancialFixture(token, profileId) {
  const wallets = await profileRequest(token, profileId, "/wallets");
  const categories = await profileRequest(token, profileId, "/categories");
  const limits = await profileRequest(token, profileId, "/limits");
  const goals = await profileRequest(token, profileId, "/goals");
  const cards = await profileRequest(token, profileId, "/cards");
  const transactions = await profileRequest(token, profileId, "/transactions");

  for (const result of [wallets, categories, limits, goals, cards, transactions]) {
    assertStatus(result, 200);
  }

  return {
    wallets: wallets.body,
    categories: categories.body,
    limits: limits.body,
    goals: goals.body,
    cards: cards.body,
    transactions: transactions.body,
  };
}

async function assertGoalMovementExists(token, profileId, goalId, movementId) {
  const goal = await profileRequest(token, profileId, `/goals/${goalId}`);
  assertStatus(goal, 200);
  assert.ok(
    goal.body.history.some((entry) => entry.id === movementId),
    `Expected goal movement ${movementId} to be present`,
  );
}

function assertStatus(result, expectedStatus) {
  assert.equal(
    result.status,
    expectedStatus,
    JSON.stringify(result.body, null, 2),
  );
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function runDatabaseQuery(sql) {
  const { stdout } = await execFileAsync(
    "psql",
    [
      process.env.DATABASE_URL,
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      sql,
    ],
    { env: process.env },
  );
  return stdout.trim();
}

async function prepareLegacyFinancialFixture(userId, profileId) {
  const scopedOwner = `${userId}::${profileId}`;
  const owner = sqlLiteral(scopedOwner);
  const profile = sqlLiteral(profileId);
  const statements = financialTables.map((table) => (
    `UPDATE ${table} SET user_id = ${owner}, profile_id = NULL ` +
    `WHERE user_id = ${owner} AND profile_id = ${profile};`
  ));

  await runDatabaseQuery(`BEGIN; ${statements.join(" ")} COMMIT;`);
}

async function prepareSimpleLegacyFinancialFixture(userId, profileId) {
  const scopedOwner = sqlLiteral(`${userId}::${profileId}`);
  const owner = sqlLiteral(userId);
  const profile = sqlLiteral(profileId);
  const statements = financialTables.map((table) => (
    `UPDATE ${table} SET user_id = ${owner}` +
    `${table === "finance_investments" ? "" : ", profile_id = NULL"} ` +
    `WHERE user_id = ${scopedOwner} AND profile_id = ${profile};`
  ));

  await runDatabaseQuery(`BEGIN; ${statements.join(" ")} COMMIT;`);
}

async function prepareLegacyInvestmentFixture(userId, personalProfileId, businessProfileId) {
  const personalOwner = sqlLiteral(userId);
  const businessOwner = sqlLiteral(`${userId}::${businessProfileId}`);
  const personalProfile = sqlLiteral(personalProfileId);
  const businessProfile = sqlLiteral(businessProfileId);
  await runDatabaseQuery(
    `INSERT INTO finance_investments ` +
    `(user_id, profile_id, name, ticker, asset_type, institution, quantity, ` +
    `average_price, invested_amount, current_value) VALUES ` +
    `(${personalOwner}, ${personalProfile}, 'legacy simple investment', 'LEGACY-S', ` +
    `'fixed_income', 'Legacy Bank', 1, 100, 100, 100), ` +
    `(${businessOwner}, ${businessProfile}, 'legacy composite investment', 'LEGACY-C', ` +
    `'fixed_income', 'Legacy Bank', 1, 100, 100, 100);`,
  );
}

async function insertAutomaticInvestmentFixture(userId, profileId) {
  const owner = sqlLiteral(`${userId}::${profileId}`);
  const profile = sqlLiteral(profileId);
  const name = `isolated automatic investment ${profileId}`;
  await runDatabaseQuery(
    `INSERT INTO finance_investments ` +
    `(user_id, profile_id, name, ticker, asset_type, institution, quantity, ` +
    `average_price, invested_amount, current_value, manual_current_value, ` +
    `valuation_mode, quote_source, quote_price, quote_status, quote_error, last_quote_at) VALUES ` +
    `(${owner}, ${profile}, ${sqlLiteral(name)}, 'OTHER-PROFILE', 'stock', ` +
    `'Other Profile Broker', 2, 200, 400, 450, 400, 'automatic', 'BRAPI', ` +
    `225, 'pending', NULL, '2026-09-13T12:00:00.000Z');`,
  );
  return name;
}

async function readInvestmentDatabaseState(name) {
  const result = await runDatabaseQuery(
    `SELECT json_build_object(` +
    `'currentValue', current_value, ` +
    `'manualCurrentValue', manual_current_value, ` +
    `'quoteStatus', quote_status, ` +
    `'lastQuoteAt', last_quote_at` +
    `)::text FROM finance_investments WHERE name = ${sqlLiteral(name)};`,
  );
  return JSON.parse(result);
}

async function countRowsForOwner(userId, profileId, table) {
  const scopedOwner = sqlLiteral(`${userId}::${profileId}`);
  const result = await runDatabaseQuery(
    `SELECT COUNT(*) FROM ${table} WHERE user_id = ${scopedOwner};`,
  );
  return Number(result);
}

async function countRowsForAccount(userId, table) {
  const owner = sqlLiteral(userId);
  const scopedOwner = sqlLiteral(`${userId}::%`);
  const result = await runDatabaseQuery(
    `SELECT COUNT(*) FROM ${table} ` +
    `WHERE user_id = ${owner} OR user_id LIKE ${scopedOwner};`,
  );
  return Number(result);
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

  before(async () => {
    await requireTestConfiguration();
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
      if (identity.deletedViaApi) {
        continue;
      }

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


describe("financial profile deletion isolation", () => {
  let identity;

  before(async () => {
    await requireTestConfiguration();
    identity = await createTemporaryIdentity("financial-profile");
  });

  after(async () => {
    if (!identity?.token) {
      return;
    }

    const result = await apiRequest(identity.token, "/account", {
      method: "DELETE",
    });
    assertStatus(result, 204);
    identity.deletedViaApi = true;
  });

  it("deletes business data without changing the personal profile", async () => {
    const initialProfiles = await apiRequest(identity.token, "/financial-profiles");
    assertStatus(initialProfiles, 200);
    assert.equal(initialProfiles.body.length, 1);
    assert.equal(initialProfiles.body[0].type, "personal");
    const personalProfile = initialProfiles.body[0];

    const createdBusiness = await apiRequest(identity.token, "/financial-profiles", {
      method: "POST",
      body: {
        type: "business",
        name: "Empresa",
        businessName: "Empresa de Teste Ltda.",
      },
    });
    assertStatus(createdBusiness, 201);
    const businessProfile = createdBusiness.body;

    const personalInvestment = await profileRequest(
      identity.token,
      personalProfile.id,
      "/investments",
      {
        method: "POST",
        body: {
          name: "Tesouro Selic",
          ticker: "TESOURO",
          assetType: "fixed_income",
          institution: "Corretora Pessoal",
          quantity: 10,
          averagePrice: 100,
          investedAmount: 1000,
          currentValue: 1100,
        },
      },
    );
    assertStatus(personalInvestment, 201);
    assert.equal(personalInvestment.body.returnAmount, 100);
    assert.equal(personalInvestment.body.returnPercentage, 10);

    const updatedPersonalInvestment = await profileRequest(
      identity.token,
      personalProfile.id,
      `/investments/${personalInvestment.body.id}`,
      {
        method: "PATCH",
        body: { currentValue: 1080 },
      },
    );
    assertStatus(updatedPersonalInvestment, 200);
    assert.equal(updatedPersonalInvestment.body.returnAmount, 80);
    assert.equal(updatedPersonalInvestment.body.returnPercentage, 8);
    assert.equal(updatedPersonalInvestment.body.valuationMode, "manual");
    assert.equal(updatedPersonalInvestment.body.manualCurrentValue, 1080);
    assert.equal(updatedPersonalInvestment.body.quoteStatus, "not_configured");
    assert.equal(updatedPersonalInvestment.body.lastQuoteAt, null);

    const automaticPersonalInvestment = await profileRequest(
      identity.token,
      personalProfile.id,
      `/investments/${personalInvestment.body.id}`,
      {
        method: "PATCH",
        body: {
          ticker: null,
          valuationMode: "automatic",
        },
      },
    );
    assertStatus(automaticPersonalInvestment, 200);
    assert.equal(automaticPersonalInvestment.body.currentValue, 1080);
    assert.equal(automaticPersonalInvestment.body.manualCurrentValue, 1080);
    assert.equal(automaticPersonalInvestment.body.quoteStatus, "pending");
    assert.equal(automaticPersonalInvestment.body.lastQuoteAt, null);

    const otherProfileInvestmentName = await insertAutomaticInvestmentFixture(
      identity.userId,
      businessProfile.id,
    );
    const otherProfileBeforeRefresh = await readInvestmentDatabaseState(
      otherProfileInvestmentName,
    );
    const refreshedPersonalInvestments = await profileRequest(
      identity.token,
      personalProfile.id,
      "/investments/refresh",
      { method: "POST" },
    );
    assertStatus(refreshedPersonalInvestments, 200);
    const refreshedPersonalInvestment = refreshedPersonalInvestments.body.find(
      (investment) => investment.id === personalInvestment.body.id,
    );
    assert.ok(refreshedPersonalInvestment);
    assert.equal(refreshedPersonalInvestment.currentValue, 1080);
    assert.equal(refreshedPersonalInvestment.manualCurrentValue, 1080);
    assert.equal(refreshedPersonalInvestment.quoteStatus, "unavailable");
    assert.equal(refreshedPersonalInvestment.lastQuoteAt, null);
    assert.deepEqual(
      await readInvestmentDatabaseState(otherProfileInvestmentName),
      otherProfileBeforeRefresh,
    );
    await runDatabaseQuery(
      `DELETE FROM finance_investments WHERE name = ${sqlLiteral(otherProfileInvestmentName)};`,
    );

    const returnedToManual = await profileRequest(
      identity.token,
      personalProfile.id,
      `/investments/${personalInvestment.body.id}`,
      {
        method: "PATCH",
        body: { valuationMode: "manual" },
      },
    );
    assertStatus(returnedToManual, 200);
    assert.equal(returnedToManual.body.currentValue, 1080);
    assert.equal(returnedToManual.body.manualCurrentValue, 1080);
    assert.equal(returnedToManual.body.valuationMode, "manual");
    assert.equal(returnedToManual.body.quoteStatus, "not_configured");
    assert.equal(returnedToManual.body.quoteSource, null);
    assert.equal(returnedToManual.body.quotePrice, null);
    assert.equal(returnedToManual.body.lastQuoteAt, null);

    const businessInvestments = await profileRequest(
      identity.token,
      businessProfile.id,
      "/investments",
    );
    assertStatus(businessInvestments, 403);

    const profilesWithBusiness = await apiRequest(identity.token, "/financial-profiles");
    assertStatus(profilesWithBusiness, 200);
    assert.deepEqual(
      profilesWithBusiness.body.map((profile) => profile.id),
      [personalProfile.id, businessProfile.id],
    );

    const personalFixture = await createFinancialFixture(
      identity.token,
      personalProfile.id,
      "personal",
    );
    const businessFixture = await createFinancialFixture(
      identity.token,
      businessProfile.id,
      "business",
    );
    await prepareLegacyFinancialFixture(identity.userId, businessProfile.id);
    await assertGoalMovementExists(
      identity.token,
      personalProfile.id,
      personalFixture.goalId,
      personalFixture.movementId,
    );
    await assertGoalMovementExists(
      identity.token,
      businessProfile.id,
      businessFixture.goalId,
      businessFixture.movementId,
    );

    const personalBeforeDeletion = await readFinancialFixture(
      identity.token,
      personalProfile.id,
    );
    const personalInvestmentsBeforeDeletion = await profileRequest(
      identity.token,
      personalProfile.id,
      "/investments",
    );
    assertStatus(personalInvestmentsBeforeDeletion, 200);
    assert.deepEqual(
      personalInvestmentsBeforeDeletion.body.map((investment) => investment.id),
      [personalInvestment.body.id],
    );
    const businessBeforeDeletion = await readFinancialFixture(
      identity.token,
      businessProfile.id,
    );
    assert.deepEqual(
      {
        wallets: personalBeforeDeletion.wallets.map((row) => row.id),
        categories: personalBeforeDeletion.categories.map((row) => row.id),
        limits: personalBeforeDeletion.limits.map((row) => row.id),
        goals: personalBeforeDeletion.goals.map((row) => row.id),
        cards: personalBeforeDeletion.cards.map((row) => row.id),
        transactions: personalBeforeDeletion.transactions.map((row) => row.id),
      },
      {
        wallets: [personalFixture.walletId],
        categories: [personalFixture.categoryId],
        limits: [personalFixture.limitId],
        goals: [personalFixture.goalId],
        cards: [personalFixture.cardId],
        transactions: [personalFixture.transactionId],
      },
    );
    assert.deepEqual(
      {
        wallets: businessBeforeDeletion.wallets.map((row) => row.id),
        categories: businessBeforeDeletion.categories.map((row) => row.id),
        limits: businessBeforeDeletion.limits.map((row) => row.id),
        goals: businessBeforeDeletion.goals.map((row) => row.id),
        cards: businessBeforeDeletion.cards.map((row) => row.id),
        transactions: businessBeforeDeletion.transactions.map((row) => row.id),
      },
      {
        wallets: [businessFixture.walletId],
        categories: [businessFixture.categoryId],
        limits: [businessFixture.limitId],
        goals: [businessFixture.goalId],
        cards: [businessFixture.cardId],
        transactions: [businessFixture.transactionId],
      },
    );

    const deletedBusiness = await apiRequest(
      identity.token,
      `/financial-profiles/${businessProfile.id}`,
      { method: "DELETE" },
    );
    assertStatus(deletedBusiness, 204);

    for (const table of financialTables) {
      assert.equal(
        await countRowsForOwner(identity.userId, businessProfile.id, table),
        0,
        `Expected legacy business rows in ${table} to be deleted`,
      );
    }

    const remainingProfiles = await apiRequest(identity.token, "/financial-profiles");
    assertStatus(remainingProfiles, 200);
    assert.deepEqual(
      remainingProfiles.body.map((profile) => ({
        id: profile.id,
        type: profile.type,
      })),
      [{ id: personalProfile.id, type: "personal" }],
    );

    for (const path of [
      "/wallets",
      "/categories",
      "/limits",
      "/goals",
      "/cards",
      "/transactions",
    ]) {
      const deletedBusinessData = await profileRequest(
        identity.token,
        businessProfile.id,
        path,
      );
      assertStatus(deletedBusinessData, 403);
    }
    const personalInvestmentsAfterBusinessDeletion = await profileRequest(
      identity.token,
      personalProfile.id,
      "/investments",
    );
    assertStatus(personalInvestmentsAfterBusinessDeletion, 200);
    assert.deepEqual(
      personalInvestmentsAfterBusinessDeletion.body.map((investment) => investment.id),
      [personalInvestment.body.id],
    );

    const deletedPersonalInvestment = await profileRequest(
      identity.token,
      personalProfile.id,
      `/investments/${personalInvestment.body.id}`,
      { method: "DELETE" },
    );
    assertStatus(deletedPersonalInvestment, 204);
    const emptyPersonalInvestments = await profileRequest(
      identity.token,
      personalProfile.id,
      "/investments",
    );
    assertStatus(emptyPersonalInvestments, 200);
    assert.deepEqual(emptyPersonalInvestments.body, []);

    const deletedPersonal = await apiRequest(
      identity.token,
      `/financial-profiles/${personalProfile.id}`,
      { method: "DELETE" },
    );
    assertStatus(deletedPersonal, 400);
    assert.equal(
      deletedPersonal.body.error,
      "The personal profile cannot be deleted",
    );

    const personalAfterFailedDeletion = await readFinancialFixture(
      identity.token,
      personalProfile.id,
    );
    assert.deepEqual(personalAfterFailedDeletion, personalBeforeDeletion);
  });
});

describe("account deletion cleanup", () => {
  let identity;

  before(async () => {
    await requireTestConfiguration();
    identity = await createTemporaryIdentity("account-deletion");
  });

  after(async () => {
    if (!identity?.token || identity.deletedViaApi) {
      return;
    }

    const result = await apiRequest(identity.token, "/account", {
      method: "DELETE",
    });
    assertStatus(result, 204);
    identity.deletedViaApi = true;
  });

  it("deletes financial rows with both simple and composite legacy owners", async () => {
    const profiles = await apiRequest(identity.token, "/financial-profiles");
    assertStatus(profiles, 200);
    const personalProfile = profiles.body.find((profile) => profile.type === "personal");
    assert.ok(personalProfile);

    const business = await apiRequest(identity.token, "/financial-profiles", {
      method: "POST",
      body: {
        type: "business",
        name: "Empresa",
        businessName: "Empresa de Teste Ltda.",
      },
    });
    assertStatus(business, 201);

    await createFinancialFixture(identity.token, personalProfile.id, "legacy simple");
    await createFinancialFixture(identity.token, business.body.id, "legacy composite");
    await prepareLegacyInvestmentFixture(
      identity.userId,
      personalProfile.id,
      business.body.id,
    );
    await prepareSimpleLegacyFinancialFixture(identity.userId, personalProfile.id);

    const deleted = await apiRequest(identity.token, "/account", {
      method: "DELETE",
    });
    assertStatus(deleted, 204);
    identity.deletedViaApi = true;

    for (const table of financialTables) {
      assert.equal(
        await countRowsForAccount(identity.userId, table),
        0,
        `Expected account deletion to remove legacy rows from ${table}`,
      );
    }
    assert.equal(
      await countRowsForAccount(identity.userId, "financial_profiles"),
      0,
      "Expected account deletion to remove financial profiles",
    );
  });
});