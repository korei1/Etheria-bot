import assert from "node:assert/strict";
import test from "node:test";
import {
  SweetTeaEconomyClient,
  SweetTeaEconomyError,
  SweetTeaEconomyUnavailableError
} from "../src/modules/economy/sweet-tea-economy-client.js";

const validConfig = {
  webhookUrl: "https://example.scnx.app/hooks/etheria",
  sharedSecret: "test-secret"
};

const validRequest = {
  operationId: "6a5fdd36-1248-4191-90fb-209fe55fdc7e",
  operation: "debit" as const,
  discordUserId: "123456789012345678",
  amount: 25,
  reasonCode: "etheria_test"
};

test("refuses an insecure or malformed webhook URL", () => {
  assert.throws(
    () => new SweetTeaEconomyClient({ ...validConfig, webhookUrl: "http://example.com" }),
    SweetTeaEconomyError
  );
  assert.throws(
    () => new SweetTeaEconomyClient({ ...validConfig, webhookUrl: "https://user:pass@example.com" }),
    SweetTeaEconomyError
  );
});

test("refuses invalid member identifiers and amounts before network access", async () => {
  const client = new SweetTeaEconomyClient(validConfig);
  await assert.rejects(
    client.execute({ ...validRequest, discordUserId: "not-a-snowflake" }),
    SweetTeaEconomyError
  );
  await assert.rejects(
    client.execute({ ...validRequest, amount: 0 }),
    SweetTeaEconomyError
  );
});

test("returns the balance reported by Sweet Tea Economy", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("x-etheria-secret"), "test-secret");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.discordUserId, validRequest.discordUserId);
    return new Response(JSON.stringify({
      operationId: validRequest.operationId,
      success: true,
      walletBalance: 475
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await new SweetTeaEconomyClient(validConfig).execute({
      ...validRequest,
      operation: "balance",
      amount: undefined
    });
    assert.equal(result.walletBalance, 475);
    assert.equal(result.success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a response for another operation id", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    operationId: "7a5fdd36-1248-4191-90fb-209fe55fdc7e",
    success: true,
    walletBalance: 475
  }), { status: 200 })) as typeof fetch;

  try {
    await assert.rejects(
      new SweetTeaEconomyClient(validConfig).execute(validRequest),
      SweetTeaEconomyUnavailableError
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("treats a failed webhook response as unavailable without local fallback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;

  try {
    await assert.rejects(
      new SweetTeaEconomyClient(validConfig).execute(validRequest),
      SweetTeaEconomyUnavailableError
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
