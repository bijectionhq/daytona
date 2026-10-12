// concave:begin native-component-definition
// preserves: packages/convex/src/component/bijection.config.ts#component-analysis
// why: Bijection native analysis finds bijection.config.ts; inherited tooling delegates to that same definition.
// witness: packages/convex/src/component/bijection.config.ts
// remove-when: The inherited tooling accepts the native definition filename.
export { default } from "./bijection.config.js";
// concave:end native-component-definition
