/// <reference types="vite/client" />
import { test } from "vitest";
import { bijectionTest } from "@bijectionhq/test";
import schema from "./schema.js";

export const modules = import.meta.glob("./**/*.*s");

export function initBijectionTest() {
  return bijectionTest(schema, modules);
}

test("setup", () => {});
