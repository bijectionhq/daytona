/// <reference types="vite/client" />
import type { TestBijection } from "@bijectionhq/test";
import type { GenericSchema, SchemaDefinition } from "bijection/server";
import schema from "./component/schema.js";

export const modules = import.meta.glob("./component/**/*.ts");

/**
 * Register the Daytona component with a `convex-test` instance, e.g.:
 *
 * ```ts
 * import { bijectionTest } from "@bijectionhq/test";
 * import daytonaTest from "@daytona/convex/test";
 * const t = bijectionTest(schema, modules);
 * daytonaTest.register(t);
 * ```
 */
export function register(
  t: TestBijection<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "daytona",
) {
  t.registerComponent(name, schema, modules);
}

export default { register, schema, modules };
