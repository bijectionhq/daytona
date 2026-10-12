import { defineComponent } from "bijection/server";
import { v } from "bijection/values";

// concave:invariant component-analysis
// One definition determines validators, functions and environment arguments;
// the tooling bridge delegates to it and bindings follow actual analysis.
const component = defineComponent("daytona", {
  // Passed down by the app in its convex.config.ts (see README). Optional so
  // existing installs keep deploying, but runBackground needs it: its poller
  // runs from the scheduler, outside any call from the app.
  env: {
    DAYTONA_API_KEY: v.optional(v.string()),
    // Signing secret of the Daytona webhook endpoint (see README). Optional:
    // webhook-driven state sync is opt-in, and the webhook route refuses every
    // request when it isn't set.
    DAYTONA_WEBHOOK_SECRET: v.optional(v.string()),
  },
});
export default component;
