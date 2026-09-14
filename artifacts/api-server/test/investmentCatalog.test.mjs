import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { searchInvestmentCatalog } from "../src/lib/investmentCatalog.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("investment catalog search", () => {
  it("returns remote stock and FII results with the expected asset types", async () => {
    let requestedUrl;
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        stocks: [
          { stock: "petr4", name: "Petróleo Brasileiro S.A.", type: "stock" },
          { stock: "MXRF11", name: "Maxi Renda FII", subType: "fii" },
          { stock: "MXRF11", name: "Duplicate result", subType: "fii" },
        ],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const results = await searchInvestmentCatalog("  petr4  ");

    assert.equal(new URL(requestedUrl).searchParams.get("search"), "PETR4");
    assert.deepEqual(results, [
      { name: "Petróleo Brasileiro S.A.", ticker: "PETR4", assetType: "stock" },
      { name: "Maxi Renda FII", ticker: "MXRF11", assetType: "fii" },
    ]);
  });

  it("propagates provider errors so the caller can keep manual registration available", async () => {
    globalThis.fetch = async () => {
      throw new Error("catalog provider unavailable");
    };

    await assert.rejects(
      () => searchInvestmentCatalog("offline-provider"),
      /catalog provider unavailable/,
    );
  });
});