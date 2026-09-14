import { cardsTable } from "./cards";
import { categoriesTable } from "./categories";
import { goalMovementsTable } from "./goalMovements";
import { goalsTable } from "./goals";
import { investmentsTable } from "./investments";
import { investmentFavoritesTable } from "./investmentFavorites";
import { limitsTable } from "./limits";
import { transactionsTable } from "./transactions";
import { walletsTable } from "./wallets";

export const financialScopeColumnNames = ["userId", "profileId"] as const;

/**
 * Every profile-scoped financial entity must be registered here.
 *
 * Keep dependent entities before the entities they reference so the list can
 * be used for deletion without relying on database cascades.
 */
export const financialEntityTables = [
  { name: "finance_transactions", table: transactionsTable },
  { name: "finance_goal_movements", table: goalMovementsTable },
  { name: "finance_limits", table: limitsTable },
  { name: "finance_goals", table: goalsTable },
  { name: "finance_cards", table: cardsTable },
  { name: "finance_investments", table: investmentsTable },
  { name: "finance_investment_favorites", table: investmentFavoritesTable },
  { name: "finance_categories", table: categoriesTable },
  { name: "finance_wallets", table: walletsTable },
] as const;

export type FinancialEntityTable = (typeof financialEntityTables)[number]["table"];

export type FinancialSchemaTable = {
  name: string;
  table: object;
};

export type FinancialEntityScopeViolation = {
  name: string;
  reason: string;
};

function hasColumn(table: object, columnName: string) {
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

/**
 * Returns scope-contract violations without touching the database.
 *
 * `financialSchemaTables` comes from the schema barrel and `financialEntityTables`
 * is the deletion registry. Keeping those inputs separate catches both a table
 * that cannot be scoped and a table that was added to the schema without being
 * registered for cleanup.
 */
export function getFinancialEntityScopeViolations(
  financialSchemaTables: readonly FinancialSchemaTable[],
  registeredEntities: readonly FinancialSchemaTable[] = financialEntityTables,
): FinancialEntityScopeViolation[] {
  const violations: FinancialEntityScopeViolation[] = [];
  const registeredByName = new Map(
    registeredEntities.map((entity) => [entity.name, entity]),
  );
  const schemaNames = new Set(financialSchemaTables.map((entity) => entity.name));

  for (const entity of financialSchemaTables) {
    const missingColumns = financialScopeColumnNames.filter(
      (columnName) => !hasColumn(entity.table, columnName),
    );

    if (missingColumns.length > 0) {
      violations.push({
        name: entity.name,
        reason: `missing required scope column(s): ${missingColumns.join(", ")}`,
      });
    }

    if (!registeredByName.has(entity.name)) {
      violations.push({
        name: entity.name,
        reason: "is not registered in financialEntityTables",
      });
    }
  }

  for (const entity of registeredEntities) {
    if (!schemaNames.has(entity.name)) {
      violations.push({
        name: entity.name,
        reason: "is registered but is not exported by the financial schema",
      });
    }
  }

  return violations;
}

export function assertFinancialEntityScopeContract(
  financialSchemaTables: readonly FinancialSchemaTable[],
  registeredEntities: readonly FinancialSchemaTable[] = financialEntityTables,
) {
  const violations = getFinancialEntityScopeViolations(
    financialSchemaTables,
    registeredEntities,
  );

  if (violations.length === 0) return;

  const details = violations
    .map(({ name, reason }) => `- ${name}: ${reason}`)
    .join("\n");
  throw new Error(`Financial entity scope contract violation(s):\n${details}`);
}