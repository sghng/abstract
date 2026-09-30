/**
 * desk TUI -- the user's desk in the sidebar (design: docs/desk.md).
 *
 * Loaded automatically: the CLI fetches the connected server's active
 * plugin list and picks up this package's tui entrypoint, so no cli.json
 * entry is needed (docs/build/plugins/cli). Read-only by design: the user
 * settles items by replying in the thread; the orchestrator rewrites the
 * desk with its tool.
 *
 * Interactions: the sidebar rows and the command both open a read-only
 * detail view rendered as Markdown. The command is <leader>d (free among
 * the default leader bindings), in the palette, and as /desk. The sidebar
 * folds like the builtin MCP section: a caret appears once the desk holds
 * more than two items.
 */
import { Plugin } from "@opencode/plugin/tui";
import { SyntaxStyle, TextAttributes, type RGBA } from "@opentui/core";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { Desk, type DeskItem } from "../../../src/desk.ts";

// The markdown renderable styles spans through markup.* scopes in its
// SyntaxStyle; an empty style renders everything as one plain string. These
// rules mirror the TUI's own generateSyntax (packages/theme/tui/syntax.ts),
// sourcing colors from the ambient theme, minus the code-grammar scopes a
// prose note never needs.
type Theme = Plugin.Context["theme"];
function buildSyntax(theme: Theme): SyntaxStyle {
  const md = theme.markdown;
  const rule = (
    scope: string[],
    foreground: RGBA,
    extra: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      background?: RGBA;
    } = {},
  ) => ({ scope, style: { foreground, ...extra } });
  return SyntaxStyle.fromTheme([
    rule(["default"], theme.text.base),
    rule(
      [
        "markup.heading",
        "markup.heading.2",
        "markup.heading.3",
        "markup.heading.4",
        "markup.heading.5",
        "markup.heading.6",
      ],
      md.heading,
      { bold: true },
    ),
    rule(["markup.heading.1"], md.heading, { bold: true, underline: true }),
    rule(["markup.bold", "markup.strong"], md.strong, { bold: true }),
    rule(["markup.italic"], md.emphasis, { italic: true }),
    rule(["markup.list"], md.listItem),
    rule(["markup.quote"], md.blockQuote, { italic: true }),
    rule(["markup.raw", "markup.raw.block"], md.code),
    rule(["markup.raw.inline"], md.code, {
      background: theme.background.base,
    }),
    rule(
      [
        "markup.link",
        "markup.link.url",
        "string.special",
        "string.special.url",
      ],
      md.link,
      { underline: true },
    ),
    rule(["markup.link.label"], md.linkText, { underline: true }),
    rule(["markup.underline"], theme.text.base, { underline: true }),
    rule(["markup.strikethrough", "markup.list.unchecked"], theme.text.muted),
    rule(["markup.list.checked"], theme.text.feedback.success.base),
  ]);
}

// SyntaxStyle holds a native handle, so cache per theme and release the
// previous one only at renderer idle, after nothing can still reference it
// (the same lifecycle as the TUI's own createSyntaxStyleMemo).
let syntaxCache: { theme: Theme; style: SyntaxStyle } | undefined;
function markdownSyntax(context: Plugin.Context): SyntaxStyle {
  const theme = context.theme;
  if (syntaxCache?.theme === theme) return syntaxCache.style;
  const previous = syntaxCache?.style;
  syntaxCache = { theme, style: buildSyntax(theme) };
  if (previous)
    void context.renderer
      .idle()
      .catch(() => {})
      .finally(() => previous.destroy());
  return syntaxCache.style;
}

function View(props: { context: Plugin.Context; sessionID: string }) {
  const [open, setOpen] = createSignal(true);
  const [items, setItems] = createSignal<DeskItem[]>([]);
  const theme = props.context.theme;
  const desk = props.context.client.rpc(Desk);
  // The desk RPC is location-scoped on the server (plugin storage keys by
  // project), so every call carries the viewed session's project; a
  // locationless call routes to the server's default location and reads an
  // empty desk (the reattach bug). Events stream globally, so they are
  // filtered by the same directory.
  const location = createMemo(
    () => props.context.data.session.get(props.sessionID)?.location,
  );
  const refresh = () => {
    const loc = location();
    if (!loc) return;
    desk
      .list({}, { location: { directory: loc.directory } })
      .then((result) => setItems(result.items))
      .catch(() => {});
  };
  createEffect(() => {
    location();
    refresh();
  });
  const stop = desk.events.on("changed", (event) => {
    if (event.location.directory !== location()?.directory) return;
    setItems(event.data.items);
  });
  onCleanup(stop);

  return (
    <Show when={items().length > 0}>
      <box>
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => items().length > 2 && setOpen((x) => !x)}
        >
          <Show when={items().length > 2}>
            <text fg={theme.text.base}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme.text.base}>
            <b>Desk</b>
            <Show when={!open()}>
              <span style={{ fg: theme.text.muted }}> ({items().length})</span>
            </Show>
          </text>
        </box>
        <Show when={items().length <= 2 || open()}>
          <For each={items()}>
            {(item) => (
              <box
                flexDirection="row"
                gap={1}
                minWidth={0}
                onMouseUp={() => showDetail(props.context, item)}
              >
                <text flexShrink={0} style={{ fg: theme.text.muted }}>
                  •
                </text>
                <text
                  fg={theme.text.base}
                  wrapMode="word"
                  flexGrow={1}
                  flexShrink={1}
                  minWidth={0}
                >
                  {item.title}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  );
}

function showDetail(context: Plugin.Context, item: DeskItem) {
  const theme = context.theme;
  context.ui.dialog.show(() => (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text
          attributes={TextAttributes.BOLD}
          fg={theme.text.base}
          wrapMode="word"
          flexGrow={1}
          flexShrink={1}
          minWidth={0}
        >
          {item.title}
        </text>
        <text fg={theme.text.muted} flexShrink={0}>
          esc
        </text>
      </box>
      <box paddingBottom={1}>
        <markdown
          content={item.detail}
          syntaxStyle={markdownSyntax(context)}
          conceal
          fg={theme.text.base}
        />
      </box>
    </box>
  ));
}

export default Plugin.define({
  id: "abstract-desk-tui",
  setup(context) {
    const desk = context.client.rpc(Desk);

    const openDesk = async () => {
      const route = context.ui.router.current();
      const directory =
        route.type === "session"
          ? context.data.session.get(context.data.session.root(route.sessionID))
              ?.location.directory
          : context.data.location.default().directory;
      const result = await desk
        .list({}, { location: { directory } })
        .catch(() => undefined);
      const current = result?.items ?? [];
      if (!current.length) {
        context.ui.toast.show({
          message: "The desk is clear",
          variant: "info",
        });
        return;
      }
      const picked = await context.ui.dialog.select({
        title: "Desk",
        options: current.map((item) => ({ title: item.title, value: item })),
      });
      if (picked) showDetail(context, picked);
    };

    // Keymap layers are owned by a component: they need the Keymap
    // provider from the UI tree, so register inside an app slot render
    // rather than at setup top level (Keymap.Provider is missing there).
    const disposeAppSlot = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "abstract.desk",
              title: "Open the desk",
              group: "abstract",
              bind: "<leader>d",
              palette: true,
              slash: { name: "desk" },
              run: openDesk,
            },
          ],
          bindings: ["abstract.desk"],
        }));
        return null;
      },
    });

    const disposeSlot = context.ui.slot({
      append: "sidebar.content",
      render: (props) => <View context={context} sessionID={props.sessionID} />,
    });

    return () => {
      disposeAppSlot();
      disposeSlot();
    };
  },
});
