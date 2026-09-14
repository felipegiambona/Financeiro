import { cardsTable } from "./cards";
import { categoriesTable } from "./categories";
import { goalMovementsTable } from "./goalMovements";
import { goalsTable } from "./goals";
import { investmentsTable } from "./investments";
import { limitsTable } from "./limits";
import { transactionsTable } from "./transactions";
import { walletsTable } from "./wallets";

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
  { name: "finance_categories", table: categoriesTable },
  { name: "finance_wallets", table: walletsTable },
] as const;

export type FinancialEntityTable = (typeof financialEntityTables)[number]["table"];