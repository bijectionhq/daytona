/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initBijectionTest } from "./setup.test.js";

const config = { apiKey: "key", apiUrl: "https://daytona.test/api" };
const sandbox = {
  id: "sandbox",
  state: "started",
  toolboxProxyUrl: "https://toolbox.test/toolbox",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("command outcome and cleanup custody", () => {
  test("missing exit evidence fails locally but keeps the provider outcome unconfirmed", async () => {
    const t = initBijectionTest();
    let sent = 0;
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        sent++;
        return json({ result: "maybe ran" });
      }
      return json(sandbox);
    });
    await expect(
      t.action(api.process.run, {
        config,
        sandboxId: "sandbox",
        command: "compute",
      }),
    ).rejects.toThrow(/Invalid Daytona command completion/);
    const [execution] = await t.query(api.executions.list, {
      sandboxId: "sandbox",
    });
    expect(execution).toMatchObject({
      status: "failed",
      outcome: "unconfirmed",
    });
    expect(execution.exitCode).toBeUndefined();
    expect(sent).toBe(1);
  });

  test("a startup refusal records that no command was dispatched", async () => {
    const t = initBijectionTest();
    vi.stubGlobal(
      "fetch",
      async () => new Response("unavailable", { status: 503 }),
    );
    await expect(
      t.action(api.process.run, {
        config,
        sandboxId: "sandbox",
        command: "compute",
      }),
    ).rejects.toThrow(/503/);
    const [execution] = await t.query(api.executions.list, {
      sandboxId: "sandbox",
    });
    expect(execution).toMatchObject({
      status: "failed",
      outcome: "not_dispatched",
    });
  });

  test("a validated nonzero exit preserves inherited synchronous action status", async () => {
    const t = initBijectionTest();
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json({ exitCode: 2, result: "failed" })
        : json(sandbox),
    );
    expect(
      await t.action(api.process.run, {
        config,
        sandboxId: "sandbox",
        command: "exit 2",
      }),
    ).toMatchObject({ exitCode: 2 });
    const [execution] = await t.query(api.executions.list, {
      sandboxId: "sandbox",
    });
    expect(execution).toMatchObject({
      status: "completed",
      outcome: "exited",
      exitCode: 2,
    });
  });

  test("lost background dispatch and failed cleanup retain identities; retry cleanup never dispatches again", async () => {
    vi.stubEnv("DAYTONA_API_KEY", config.apiKey);
    const t = initBijectionTest();
    let cleanupWorks = false;
    let sent = 0;
    let sessionId = "";
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE")
        return new Response(null, { status: cleanupWorks ? 404 : 503 });
      if (init?.method === "POST" && url.endsWith("/exec")) {
        sent++;
        const [execution] = await t.query(api.executions.list, {
          sandboxId: "sandbox",
        });
        expect(execution.outcome).toBe("unconfirmed");
        expect(execution.cleanup).toBe("pending");
        expect(execution.sessionId).toBe(sessionId);
        throw new Error("Lost dispatch reply");
      }
      if (init?.method === "POST") {
        sessionId = JSON.parse(init.body as string).sessionId;
        return json({});
      }
      return json(sandbox);
    });
    await expect(
      t.action(api.process.runBackground, {
        sandboxId: "sandbox",
        apiUrl: config.apiUrl,
        command: "compute",
      }),
    ).rejects.toThrow(/Lost dispatch reply/);
    const [execution] = await t.query(api.executions.list, {
      sandboxId: "sandbox",
    });
    expect(execution).toMatchObject({
      status: "failed",
      outcome: "unconfirmed",
      cleanup: "pending",
      sessionId,
    });
    cleanupWorks = true;
    expect(
      await t.action(api.process.retryCleanup, {
        executionId: execution._id,
        apiUrl: config.apiUrl,
      }),
    ).toEqual({ cleanup: "acknowledged" });
    expect(
      await t.action(api.process.retryCleanup, {
        executionId: execution._id,
        apiUrl: config.apiUrl,
      }),
    ).toEqual({ cleanup: "acknowledged" });
    expect(
      (await t.query(api.executions.get, { executionId: execution._id }))
        ?.outcome,
    ).toBe("unconfirmed");
    expect(sent).toBe(1);
  });

  test("a lost session creation reply retains the session without claiming a command was sent", async () => {
    vi.stubEnv("DAYTONA_API_KEY", config.apiKey);
    const t = initBijectionTest();
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("Lost creation reply");
      if (init?.method === "DELETE") return new Response(null, { status: 503 });
      return json(sandbox);
    });
    await expect(
      t.action(api.process.runBackground, {
        sandboxId: "sandbox",
        command: "compute",
      }),
    ).rejects.toThrow(/Lost creation reply/);
    const [execution] = await t.query(api.executions.list, {
      sandboxId: "sandbox",
    });
    expect(execution).toMatchObject({
      status: "failed",
      outcome: "not_dispatched",
      cleanup: "pending",
    });
    expect(execution.sessionId).toContain("convex-exec-");
  });

  test("a failed supervisor never claims the command exited or cleanup succeeded", async () => {
    vi.stubEnv("DAYTONA_API_KEY", config.apiKey);
    const t = initBijectionTest();
    const executionId = await t.mutation(internal.executions.startExecution, {
      sandboxId: "sandbox",
      kind: "command",
      input: "compute",
    });
    await t.mutation(internal.executions.updateExecution, {
      executionId,
      sessionId: "session",
      commandId: "command",
      outcome: "unconfirmed",
    });
    vi.stubGlobal("fetch", async (url: string) =>
      url.endsWith("/sandbox/sandbox")
        ? json(sandbox)
        : new Response(null, { status: 503 }),
    );
    await t.action(internal.process.pollExecution, {
      executionId,
      delayMs: 1000,
      failures: 4,
    });
    expect(await t.query(api.executions.get, { executionId })).toMatchObject({
      status: "failed",
      outcome: "unconfirmed",
      cleanup: "pending",
    });
  });

  test("purge retains unknown outcomes and pending cleanup", async () => {
    const t = initBijectionTest();
    const executionId = await t.mutation(internal.executions.startExecution, {
      sandboxId: "sandbox",
      kind: "command",
      input: "compute",
    });
    await t.mutation(internal.executions.updateExecution, {
      executionId,
      outcome: "unconfirmed",
    });
    await t.mutation(internal.executions.finishExecution, {
      executionId,
      status: "failed",
    });
    expect(await t.mutation(api.executions.purge, { olderThanMs: 0 })).toEqual({
      deleted: 0,
      hasMore: false,
    });
    await t.mutation(internal.executions.recordCleanup, {
      executionId,
      cleanup: "pending",
    });
    expect(await t.query(api.executions.get, { executionId })).not.toBeNull();
  });

  test("pending cleanup survives purge after a confirmed command exit", async () => {
    const t = initBijectionTest();
    const executionId = await t.mutation(internal.executions.startExecution, {
      sandboxId: "sandbox",
      kind: "command",
      input: "compute",
    });
    await t.mutation(internal.executions.recordCleanup, {
      executionId,
      cleanup: "pending",
    });
    await t.mutation(internal.executions.finishExecution, {
      executionId,
      status: "completed",
      outcome: "exited",
      exitCode: 0,
    });
    expect(await t.mutation(api.executions.purge, { olderThanMs: 0 })).toEqual({
      deleted: 0,
      hasMore: false,
    });
    await t.mutation(internal.executions.recordCleanup, {
      executionId,
      cleanup: "acknowledged",
    });
    expect(await t.mutation(api.executions.purge, { olderThanMs: 0 })).toEqual({
      deleted: 1,
      hasMore: false,
    });
  });

  test("cancellation refuses an unacknowledged session without deleting or dispatching", async () => {
    vi.stubEnv("DAYTONA_API_KEY", config.apiKey);
    const t = initBijectionTest();
    const executionId = await t.mutation(internal.executions.startExecution, {
      sandboxId: "sandbox",
      kind: "command",
      input: "compute",
    });
    await t.mutation(internal.executions.updateExecution, {
      executionId,
      sessionId: "session",
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      t.action(api.process.cancelExecution, { executionId }),
    ).rejects.toThrow(/Only acknowledged background/);
    expect(fetch).not.toHaveBeenCalled();
    expect(await t.query(api.executions.get, { executionId })).toMatchObject({
      status: "running",
      outcome: "not_dispatched",
    });
  });

  test("acknowledged cleanup cannot be rolled back by a later stale pending write", async () => {
    const t = initBijectionTest();
    const executionId = await t.mutation(internal.executions.startExecution, {
      sandboxId: "sandbox",
      kind: "command",
      input: "compute",
    });
    await t.mutation(internal.executions.recordCleanup, {
      executionId,
      cleanup: "acknowledged",
    });
    await t.mutation(internal.executions.recordCleanup, {
      executionId,
      cleanup: "pending",
    });
    expect((await t.query(api.executions.get, { executionId }))?.cleanup).toBe(
      "acknowledged",
    );
  });
});
