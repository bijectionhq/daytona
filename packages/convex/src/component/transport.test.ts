import { afterEach, describe, expect, test, vi } from "vitest";
import {
  executionResponse,
  MAX_PROVIDER_RESPONSE_BYTES,
  PROVIDER_REQUEST_TIMEOUT_MS,
  providerResponse,
} from "./transport.js";

const url = "https://daytona.test/api";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("provider byte custody", () => {
  test("refuses a chunked body over the bound and cancels its stream", async () => {
    const cancelled = vi.fn();
    const chunk = new Uint8Array(1024 * 1024);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(chunk);
            },
            cancel: cancelled,
          }),
        ),
    );
    await expect(providerResponse(url, {})).rejects.toThrow(/exceeds 8 MiB/);
    expect(cancelled).toHaveBeenCalledOnce();
  });

  test("counts bytes even when a provider lies about Content-Length", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(new Uint8Array(MAX_PROVIDER_RESPONSE_BYTES + 1), {
          headers: { "Content-Length": "1" },
        }),
    );
    await expect(providerResponse(url, {})).rejects.toThrow(/exceeds 8 MiB/);
  });

  test("accepts the exact bound and preserves binary contents", async () => {
    const bytes = new Uint8Array(MAX_PROVIDER_RESPONSE_BYTES);
    bytes[bytes.length - 1] = 255;
    vi.stubGlobal("fetch", async () => new Response(bytes));
    const received = new Uint8Array(
      await (await providerResponse(url, {})).arrayBuffer(),
    );
    expect(received.byteLength).toBe(bytes.byteLength);
    expect(received[received.length - 1]).toBe(255);
  });

  test("bounds error details without losing HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("x".repeat(10_000), { status: 503 }),
    );
    const response = await providerResponse(url, {});
    expect(response.status).toBe(503);
    expect((await response.text()).length).toBe(2_000);
  });

  test("the deadline covers a fetch that never returns", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise(() => {});
    });
    const result = expect(providerResponse(url, {})).rejects.toThrow(
      /deadline/,
    );
    await vi.advanceTimersByTimeAsync(PROVIDER_REQUEST_TIMEOUT_MS);
    await result;
    expect(signal?.aborted).toBe(true);
  });

  test("the same deadline covers a body that never completes", async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            pull() {
              return new Promise(() => {});
            },
            cancel: cancelled,
          }),
        ),
    );
    const result = expect(providerResponse(url, {})).rejects.toThrow(
      /deadline/,
    );
    await vi.advanceTimersByTimeAsync(PROVIDER_REQUEST_TIMEOUT_MS);
    await result;
    expect(cancelled).toHaveBeenCalledOnce();
  });
});

describe("provider command completion", () => {
  test.each([
    {},
    { exitCode: null },
    { exitCode: "0" },
    { exitCode: 0.5 },
    { exitCode: Infinity },
    { exitCode: NaN },
    { exitCode: 0, result: {} },
  ])("refuses an invalid completion %j", (value) => {
    expect(() => executionResponse(value)).toThrow(/Invalid Daytona/);
  });
  test("keeps the provider exit code and inherited stdout variant", () => {
    expect(
      executionResponse({ exitCode: 2, artifacts: { stdout: "failed" } }),
    ).toMatchObject({ exitCode: 2, result: "failed" });
  });
});
