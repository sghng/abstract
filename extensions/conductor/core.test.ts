import { describe, expect, test } from "bun:test";
import {
  expandEnv,
  filterToolNames,
  mergeConfigs,
  parseConfig,
  sanitizeName,
  serversForRole,
  toolName,
} from "./core.ts";

describe("expandEnv", () => {
  test("expands ${VAR} from the given env", () => {
    expect(expandEnv("key=${KEY}", { KEY: "abc" } as NodeJS.ProcessEnv)).toBe("key=abc");
  });
  test("unknown vars expand to empty string", () => {
    expect(expandEnv("${NOPE}", {} as NodeJS.ProcessEnv)).toBe("");
  });
  test("leaves plain strings untouched", () => {
    expect(expandEnv("no-vars", {} as NodeJS.ProcessEnv)).toBe("no-vars");
  });
});

describe("mergeConfigs", () => {
  test("later layers override whole server entries by name", () => {
    const merged = mergeConfigs([
      { mcpServers: { a: { url: "https://a" }, b: { url: "https://b" } } },
      { mcpServers: { b: { url: "https://b2" } } },
    ]);
    expect(merged.mcpServers!.a.url).toBe("https://a");
    expect(merged.mcpServers!.b.url).toBe("https://b2");
  });
});

describe("serversForRole", () => {
  const merged = mergeConfigs([
    {
      mcpServers: {
        everyone: { url: "https://x" },
        libOnly: { url: "https://y", roles: ["librarian"] },
        perRole: {
          url: "https://z",
          roles: { librarian: { tools: ["t1"] }, engineer: {} },
        },
        serverWide: {
          url: "https://w",
          tools: ["a", "b"],
          excludeTools: ["c"],
          roles: { librarian: { tools: ["b"], excludeTools: ["d"] } },
        },
        oauth: { url: "https://o", auth: "oauth" },
        broken: {},
        stdio: { command: "uvx", args: ["run", "${PKG}"], env: { K: "${V}" } },
      },
    },
  ]);

  test("roles absent means all roles", () => {
    const names = serversForRole(merged, "engineer").map((s) => s.name);
    expect(names).toContain("everyone");
  });

  test("roles array restricts to listed roles", () => {
    expect(serversForRole(merged, "engineer").map((s) => s.name)).not.toContain("libOnly");
    expect(serversForRole(merged, "librarian").map((s) => s.name)).toContain("libOnly");
  });

  test("roles object carries per-role tool filters", () => {
    const lib = serversForRole(merged, "librarian").find((s) => s.name === "perRole")!;
    expect(lib.filter.tools).toEqual(["t1"]);
    const eng = serversForRole(merged, "engineer").find((s) => s.name === "perRole")!;
    expect(eng.filter.tools).toBeUndefined();
    expect(serversForRole(merged, "orchestrator").map((s) => s.name)).not.toContain("perRole");
  });

  test("server-wide and per-role filters merge", () => {
    const lib = serversForRole(merged, "librarian").find((s) => s.name === "serverWide")!;
    expect(lib.filter.tools).toEqual(["b"]); // intersection of ["a","b"] and ["b"]
    expect(lib.filter.excludeTools).toEqual(["c", "d"]); // union
  });

  test("oauth servers and shapeless entries are skipped", () => {
    const names = serversForRole(merged, "librarian").map((s) => s.name);
    expect(names).not.toContain("oauth");
    expect(names).not.toContain("broken");
  });

  test("kind detection and env expansion", () => {
    const stdio = serversForRole(merged, "engineer", { PKG: "pkg", V: "val" } as NodeJS.ProcessEnv).find(
      (s) => s.name === "stdio",
    )!;
    expect(stdio.kind).toBe("stdio");
    expect(stdio.config.args).toEqual(["run", "pkg"]);
    expect(stdio.config.env).toEqual({ K: "val" });
  });
});

describe("filterToolNames", () => {
  test("allowlist then denylist", () => {
    expect(filterToolNames(["a", "b", "c"], { tools: ["a", "b"], excludeTools: ["b"] })).toEqual(["a"]);
  });
  test("empty filter passes everything", () => {
    expect(filterToolNames(["a", "b"], {})).toEqual(["a", "b"]);
  });
});

describe("naming", () => {
  test("sanitizeName replaces unsafe characters", () => {
    expect(sanitizeName("my server!")).toBe("my_server_");
  });
  test("toolName namespaces under mcp__", () => {
    expect(toolName("zotero", "search items")).toBe("mcp__zotero__search_items");
  });
});

describe("parseConfig", () => {
  test("rejects non-object roots", () => {
    expect(() => parseConfig("[1]", "x.json")).toThrow(/mcpServers/);
  });
  test("accepts empty object", () => {
    expect(parseConfig("{}", "x.json")).toEqual({});
  });
});
