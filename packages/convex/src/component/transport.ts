/** Bounded provider bytes. These checks establish no authority or provenance. */
import type { ProcessExecutionResponse } from "./types.js";

export const MAX_PROVIDER_RESPONSE_BYTES = 8 * 1024 * 1024;
/** Match the inherited action ceiling; individual native runs may end sooner. */
export const PROVIDER_REQUEST_TIMEOUT_MS = 10 * 60_000;
const MAX_ERROR_RESPONSE_BYTES = 2_000;

// concave:invariant bounded-provider-response
// Fetch and body custody share one deadline. Admission counts actual stream bytes,
// not Content-Length, UTF-16 characters or a truncation after allocation.
export async function providerResponse(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      void reader?.cancel().catch(() => undefined);
      reject(
        new Error("Daytona provider request exceeded its 10 minute deadline"),
      );
    }, PROVIDER_REQUEST_TIMEOUT_MS);
  });
  const receive = async () => {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (controller.signal.aborted) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error(
        "Daytona provider request exceeded its 10 minute deadline",
      );
    }
    const limit = response.ok
      ? MAX_PROVIDER_RESPONSE_BYTES
      : MAX_ERROR_RESPONSE_BYTES;
    const length = response.headers.get("content-length");
    if (response.ok && length !== null && Number(length) > limit) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error("Daytona provider response exceeds 8 MiB");
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (size + value.byteLength > limit) {
          void reader.cancel().catch(() => undefined);
          if (response.ok)
            throw new Error("Daytona provider response exceeds 8 MiB");
          chunks.push(value.subarray(0, limit - size));
          size = limit;
          break;
        }
        chunks.push(value);
        size += value.byteLength;
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const headers = new Headers(response.headers);
    // fetch has already decoded transfer/content encoding; the new body is bytes.
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(response.body === null ? null : bytes, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
  try {
    return await Promise.race([receive(), expired]);
  } finally {
    clearTimeout(timer);
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}

// concave:invariant confirmed-command-exit
// Only an actual finite integer exit code establishes command completion.
// A transport or protocol failure leaves the provider outcome unconfirmed.
export function executionResponse(value: unknown): ProcessExecutionResponse {
  const response = value as Partial<ProcessExecutionResponse> | null;
  if (
    !response ||
    typeof response !== "object" ||
    Array.isArray(response) ||
    !Number.isSafeInteger(response.exitCode) ||
    (response.result !== undefined && typeof response.result !== "string") ||
    (response.artifacts?.stdout !== undefined &&
      typeof response.artifacts.stdout !== "string")
  )
    throw new Error("Invalid Daytona command completion response");
  return {
    ...response,
    exitCode: response.exitCode!,
    result: response.result ?? response.artifacts?.stdout ?? "",
  };
}

// concave:invariant acknowledged-session-command
// An empty or missing command identity cannot establish an acknowledged dispatch.
export function sessionExecutionResponse(value: unknown): { cmdId: string } {
  const response = value as { cmdId?: unknown } | null;
  if (!response || typeof response.cmdId !== "string" || !response.cmdId)
    throw new Error("Invalid Daytona command acknowledgement");
  return { cmdId: response.cmdId };
}

// concave:invariant confirmed-session-command-exit
// A command may still be running; a present exit code must be an actual integer.
export function sessionCommandResponse(value: unknown): {
  id: string;
  command: string;
  exitCode?: number | null;
} {
  const response = value as {
    id?: unknown;
    command?: unknown;
    exitCode?: unknown;
  } | null;
  if (
    !response ||
    typeof response.id !== "string" ||
    typeof response.command !== "string" ||
    (response.exitCode !== undefined &&
      response.exitCode !== null &&
      !Number.isSafeInteger(response.exitCode))
  )
    throw new Error("Invalid Daytona session command response");
  return response as { id: string; command: string; exitCode?: number | null };
}
