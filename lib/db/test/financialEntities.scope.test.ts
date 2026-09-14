import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertFinancialEntityScopeContract,
  financialEntityTables,
  getFinancialEntityScopeViolations,
  type FinancialSchemaTable,
} from "../src/schema/financialEntities";
import { financialSchemaTables } from "../src/schema";

describe("financial entity scope contract", () => {
  it("accepts every exported financial table registered for cleanup", () => {
    assert.doesNotThrow(() =>
      assertFinancialEntityScopeContract(
        financialSchemaTables,
        financialEntityTables,
      ),
    );
  });

  it("reports missing scope columns and missing cleanup registration", () => {
    const unscopedTable: FinancialSchemaTable = {
      name: "finance_unscoped",
      table: {},
    };

    assert.deepEqual(getFinancialEntityScopeViolations([unscopedTable], []), [
      {
        name: "finance_unscoped",
        reason: "missing required scope column(s): userId, profileId",
      },
      {
        name: "finance_unscoped",
        reason: "is not registered in financialEntityTables",
      },
    ]);

    assert.throws(
      () => assertFinancialEntityScopeContract([unscopedTable], []),
      /Financial entity scope contract violation\(s\):[\s\S]*finance_unscoped: missing required scope column\(s\): userId, profileId[\s\S]*finance_unscoped: is not registered in financialEntityTables/,
    );
  });

  it("reports a financial table exported by the schema but absent from cleanup", () => {
    const scopedTable: FinancialSchemaTable = {
      name: "finance_not_registered",
      table: { userId: {}, profileId: {} },
    };

    assert.deepEqual(
      getFinancialEntityScopeViolations([scopedTable], []),
      [
        {
          name: "finance_not_registered",
          reason: "is not registered in financialEntityTables",
        },
      ],
    );
  });
});