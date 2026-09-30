/**
 * The desk contract, shared by the desk plugin's server entry
 * (config/plugin/desk/index.ts) and TUI entry (config/plugin/desk/tui.tsx).
 * It lives outside config/plugin/ on purpose: every file directly under
 * config/plugin/ must itself be a loadable plugin, so shared code stays in
 * src/ (same pattern as src/binder.ts).
 *
 * The changed event carries the full desk, so subscribers never refetch.
 * See docs/desk.md for the design.
 */
import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";

export const DeskItem = z.object({
  title: z.string(),
  detail: z.string(),
});
export type DeskItem = z.infer<typeof DeskItem>;

export const Desk = Rpc.define({
  id: "abstract.desk",
  methods: {
    list: {
      input: z.object({}),
      output: z.object({ items: z.array(DeskItem) }),
    },
  },
  events: {
    changed: { schema: z.object({ items: z.array(DeskItem) }) },
  },
});
