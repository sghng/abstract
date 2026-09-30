/**
 * desk TUI plugin -- the user's persistent review queue sidebar.
 *
 * The server-side desk (tool, context hook, and RPC) lives in the harness
 * plugin so the desk is always on, like cue. This plugin only provides the
 * TUI entry that renders the sidebar and detail dialogs; it talks to the
 * RPC registered by abstract-harness.
 *
 * See docs/desk.md for the full design.
 */
import { Plugin } from "@opencode/plugin";

export default Plugin.define({
  id: "abstract-desk",
  setup: async () => {
    // Server-side behavior is in config/plugin/harness.ts.
  },
});
