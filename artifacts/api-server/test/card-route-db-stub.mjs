const table = (name, columns) => Object.assign(
  { name },
  Object.fromEntries(columns.map((column) => [column, { table: name, name: column }])),
);

export const cardsTable = table("cards", [
  "id",
  "userId",
  "profileId",
  "name",
  "dueDay",
  "closingDay",
  "currentInvoiceAmount",
  "availableLimit",
  "invoiceStatus",
  "createdAt",
  "updatedAt",
]);

export const transactionsTable = table("transactions", [
  "id",
  "userId",
  "profileId",
  "walletId",
  "cardId",
  "cardEntryType",
  "cardInvoiceMonth",
  "destinationWalletId",
  "categoryId",
  "goalId",
  "type",
  "amount",
  "description",
  "date",
  "dueDate",
  "recurrence",
  "paymentStatus",
  "paymentStatusOverrides",
  "createdAt",
  "updatedAt",
]);

export const categoriesTable = table("categories", ["id", "userId", "name"]);
export const walletsTable = table("wallets", ["id", "userId", "isDefault"]);
export const financialProfilesTable = table("financialProfiles", ["id", "userId", "type"]);
export const goalMovementsTable = table("goalMovements", ["id", "userId"]);
export const goalsTable = table("goals", ["id", "userId"]);
export const limitsTable = table("limits", ["id", "userId"]);

export const db = undefined;