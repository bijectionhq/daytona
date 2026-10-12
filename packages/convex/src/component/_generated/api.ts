/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `bijection dev`.
 * @module
 */
import type * as daytona from "../daytona.js";
import type * as executions from "../executions.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as process from "../process.js";
import type * as sandboxes from "../sandboxes.js";
import type * as transport from "../transport.js";
import type * as types from "../types.js";
import type * as webhooks from "../webhooks.js";
import type { ApiFromModules } from "bijection/server";
type FunctionExport<Module, Name extends PropertyKey> = Name extends keyof Module ? Module[Name] : Module extends {
    default: infer Bundle;
} ? Name extends keyof Bundle ? Bundle[Name] : never : never;
type FunctionReferenceFor<Module, Name extends PropertyKey> = ApiFromModules<{
    _: {
        handler: FunctionExport<Module, Name>;
    };
}> extends {
    _: {
        handler: infer Reference;
    };
} ? Reference : never;
import type { FunctionReference } from "bijection/server";
import type { GenericId as Id } from "bijection/values";
import { anyApi, componentsGeneric } from "bijection/server";
/**
 * A utility for referencing Bijection functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: {
    "executions": {
        "get": FunctionReferenceFor<typeof executions, "get">;
        "list": FunctionReferenceFor<typeof executions, "list">;
        "purge": FunctionReferenceFor<typeof executions, "purge">;
    };
    "files": {
        "deleteFile": FunctionReferenceFor<typeof files, "deleteFile">;
        "listFiles": FunctionReferenceFor<typeof files, "listFiles">;
        "readFile": FunctionReferenceFor<typeof files, "readFile">;
        "readFileBytes": FunctionReferenceFor<typeof files, "readFileBytes">;
        "writeFile": FunctionReferenceFor<typeof files, "writeFile">;
        "writeFileBytes": FunctionReferenceFor<typeof files, "writeFileBytes">;
    };
    "process": {
        "cancelExecution": FunctionReferenceFor<typeof process, "cancelExecution">;
        "retryCleanup": FunctionReferenceFor<typeof process, "retryCleanup">;
        "run": FunctionReferenceFor<typeof process, "run">;
        "runBackground": FunctionReferenceFor<typeof process, "runBackground">;
        "runCode": FunctionReferenceFor<typeof process, "runCode">;
    };
    "sandboxes": {
        "create": FunctionReferenceFor<typeof sandboxes, "create">;
        "get": FunctionReferenceFor<typeof sandboxes, "get">;
        "list": FunctionReferenceFor<typeof sandboxes, "list">;
        "listPaginated": FunctionReferenceFor<typeof sandboxes, "listPaginated">;
        "previewUrl": FunctionReferenceFor<typeof sandboxes, "previewUrl">;
        "purge": FunctionReferenceFor<typeof sandboxes, "purge">;
        "refresh": FunctionReferenceFor<typeof sandboxes, "refresh">;
        "remove": FunctionReferenceFor<typeof sandboxes, "remove">;
        "start": FunctionReferenceFor<typeof sandboxes, "start">;
        "stop": FunctionReferenceFor<typeof sandboxes, "stop">;
    };
} = anyApi as any;
/**
 * A utility for referencing Bijection functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: {
    "executions": {
        "finishExecution": FunctionReferenceFor<typeof executions, "finishExecution">;
        "getInternal": FunctionReferenceFor<typeof executions, "getInternal">;
        "recordCleanup": FunctionReferenceFor<typeof executions, "recordCleanup">;
        "startExecution": FunctionReferenceFor<typeof executions, "startExecution">;
        "updateExecution": FunctionReferenceFor<typeof executions, "updateExecution">;
    };
    "process": {
        "pollExecution": FunctionReferenceFor<typeof process, "pollExecution">;
    };
    "sandboxes": {
        "setSandboxError": FunctionReferenceFor<typeof sandboxes, "setSandboxError">;
        "upsertSandbox": FunctionReferenceFor<typeof sandboxes, "upsertSandbox">;
    };
    "webhooks": {
        "applyStateEvent": FunctionReferenceFor<typeof webhooks, "applyStateEvent">;
    };
} = anyApi as any;
export const components = componentsGeneric() as unknown as {};
