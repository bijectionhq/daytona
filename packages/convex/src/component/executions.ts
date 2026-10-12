/**
 * Copyright Daytona Platforms Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Execution records: reactive queries over the `executions` table, plus the
 * internal bookkeeping mutations used by the process actions.
 */

import { v } from "bijection/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js";
import { executionFields } from "./schema.js";
import { clampLimit } from "./types.js";

export const executionDoc = v.object({
  ...executionFields,
  _id: v.id("executions"),
  _creationTime: v.number(),
});

export const list = query({
  args: { sandboxId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(executionDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("executions")
      .withIndex("sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .order("desc")
      .take(clampLimit(args.limit, 50));
  },
});

export const get = query({
  args: { executionId: v.id("executions") },
  returns: v.union(v.null(), executionDoc),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.executionId);
  },
});

export const getInternal = internalQuery({
  args: { executionId: v.id("executions") },
  returns: v.union(v.null(), executionDoc),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.executionId);
  },
});

// concave:begin provider-dispatch-custody
// why: Retain possible command delivery separately from inherited action status, with its obligation on the actual record owner.
// preserves: packages/convex/src/component/executions.ts#execution-custody
// witness: packages/convex/src/component/custody.test.ts
// remove-when: Upstream retains provider outcome evidence separately from local action status.
// concave:invariant execution-custody
// Retain possible command delivery before transmission and actual exit evidence
// independently of local action status. Cleanup acknowledgement never proves exit.
export const updateExecution = internalMutation({
  args: {
    executionId: v.id("executions"),
    sessionId: v.optional(v.string()),
    outcome: v.optional(v.literal("unconfirmed")),
    commandId: v.optional(v.string()),
    result: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { executionId, ...fields } = args;
    const defined = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    await ctx.db.patch(executionId, defined);
    return null;
  },
});
// concave:end provider-dispatch-custody

export const startExecution = internalMutation({
  args: {
    sandboxId: v.string(),
    kind: v.union(v.literal("command"), v.literal("code")),
    input: v.string(),
    cwd: v.optional(v.string()),
    onComplete: v.optional(v.string()),
    onCompleteContext: v.optional(v.any()),
  },
  returns: v.id("executions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("executions", {
      ...args,
      // concave:begin provider-initial-custody
      // why: A new execution has no transmitted command until dispatch custody commits.
      // preserves: packages/convex/src/component/executions.ts#execution-custody
      // witness: packages/convex/src/component/custody.test.ts
      // remove-when: Upstream distinguishes action lifecycle, remote outcome and cleanup custody.
      outcome: "not_dispatched",
      // concave:end provider-initial-custody
      status: "running",
      startedAt: Date.now(),
    });
  },
});

export const finishExecution = internalMutation({
  args: {
    executionId: v.id("executions"),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    // concave:begin provider-exit-custody
    // why: Only a validated provider exit response can settle the command outcome.
    // preserves: packages/convex/src/component/executions.ts#execution-custody
    // witness: packages/convex/src/component/custody.test.ts
    // remove-when: Upstream distinguishes action lifecycle, remote outcome and cleanup custody.
    outcome: v.optional(v.literal("exited")),
    // concave:end provider-exit-custody
    exitCode: v.optional(v.number()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  /** True if this call performed the running -> terminal transition. */
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { executionId, ...rest } = args;
    const execution = await ctx.db.get(executionId);
    // Terminal states are final: a poll that raced a cancellation (or vice
    // versa) must not overwrite the winner, and must not notify again.
    if (!execution || execution.status !== "running") return false;
    await ctx.db.patch(executionId, { ...rest, finishedAt: Date.now() });
    return true;
  },
});

/**
 * Delete terminal execution rows older than a cutoff, in bounded batches.
 * Returns how many were deleted and whether more remain — call again until
 * `hasMore` is false. Host apps gate access with their own auth.
 */
export const purge = mutation({
  args: {
    olderThanMs: v.number(),
    sandboxId: v.optional(v.string()),
  },
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.olderThanMs) || args.olderThanMs < 0) {
      throw new Error("olderThanMs must be a non-negative finite number");
    }
    const cutoff = Date.now() - args.olderThanMs;
    // Filter BEFORE taking the batch, so repeated calls always make progress
    // (a prefix of running/recent rows can't stall the purge forever).
    const base = args.sandboxId
      ? ctx.db
          .query("executions")
          .withIndex("sandboxId", (q) => q.eq("sandboxId", args.sandboxId!))
      : ctx.db.query("executions");
    const victims = await base
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "running"),
          // concave:begin unresolved-execution-retention
          // why: Deleting an unconfirmed outcome or pending cleanup would erase the only retained remote-work evidence.
          // preserves: packages/convex/src/component/executions.ts#execution-custody
          // witness: packages/convex/src/component/custody.test.ts
          // remove-when: Upstream purge retains unresolved remote outcomes and cleanup obligations.
          q.neq(q.field("outcome"), "unconfirmed"),
          q.neq(q.field("cleanup"), "pending"),
          // concave:end unresolved-execution-retention
          q.lte(q.field("startedAt"), cutoff),
        ),
      )
      .take(200);
    for (const victim of victims) {
      await ctx.db.delete(victim._id);
    }
    return { deleted: victims.length, hasMore: victims.length === 200 };
  },
});

// concave:begin provider-cleanup-record
// why: Cleanup acknowledgement is monotone and does not overwrite a terminal action or uncertain command outcome.
// preserves: packages/convex/src/component/executions.ts#execution-custody
// witness: packages/convex/src/component/custody.test.ts
// remove-when: Upstream keeps cleanup evidence separately from action status.
/** Cleanup evidence can settle after the action, without overwriting its outcome. */
export const recordCleanup = internalMutation({
  args: {
    executionId: v.id("executions"),
    cleanup: v.union(v.literal("pending"), v.literal("acknowledged")),
  },
  returns: v.null(),
  handler: async (ctx, { executionId, cleanup }) => {
    const execution = await ctx.db.get(executionId);
    if (!execution || execution.cleanup === "acknowledged") return null;
    await ctx.db.patch(executionId, { cleanup });
    return null;
  },
});
// concave:end provider-cleanup-record
