import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import http from "node:http";
import express from "express";
import { searchInvestmentsHandler } from "../src/routes/investments.ts";

const originalFetch = globalThis.fetch;
let server;
let port;

function request(path) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: "127.0.0.1", port, path, method: "GET" },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            body: body ? JSON.parse(body) : undefined,
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

before(async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.profileType = "personal";
    next();
  });
  app.get("/api/investments/search", searchInvestmentsHandler);
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

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("investment search HTTP endpoint", () => {
  it("returns 502 when the catalog provider fails", async () => {
    globalThis.fetch = async () => {
      throw new Error("catalog provider unavailable");
    };

    const response = await request("/api/investments/search?q=offline-provider");

    assert.equal(response.status, 502);
    assert.deepEqual(response.body, {
      error: "Investment catalog is temporarily unavailable",
    });
  });

  it("returns 200 with an empty list when the catalog has no matching assets", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ stocks: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    const response = await request("/api/investments/search?q=empty-catalog");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  });
});