import { defineConfig } from "vitepress";

// Local manual site. Not deployed: run `bun run docs:dev` and open the
// printed localhost URL. Structure mirrors the repo docs split:
// docs/repertoire/ = corpus manual (rebuild-from-zero reference),
// docs root = harness/prompt docs.
export default defineConfig({
  title: "abstract",
  description: "Lab + repertoire manual",
  cleanUrls: true,
  ignoreDeadLinks: true, // decision-log prose cites historical paths
  markdown: {
    // docs use GFM only; bare <family>/<doi_id> tokens in prose must
    // render literally, not parse as HTML through the Vue compiler
    html: false,
  },
  sidebar: [
    {
      text: "Repertoire manual",
      items: [
        { text: "Overview + spec", link: "/repertoire/" },
        { text: "Fetch layer", link: "/repertoire/fetch" },
        { text: "Parse layer", link: "/repertoire/parse" },
        { text: "Storage layout", link: "/repertoire/storage" },
        { text: "Host fleet", link: "/repertoire/hostfleet" },
        { text: "Rebuild runbook", link: "/repertoire/rebuild" },
        { text: "ETL audit (2026-09-14)", link: "/repertoire/audit" },
        {
          text: "Rebuild decisions (2026-09-09)",
          link: "/repertoire/rebuild-decisions",
        },
      ],
    },
    {
      text: "Harness",
      items: [
        { text: "Multi-agent pattern", link: "/multi-agent" },
        { text: "Implementation plan", link: "/harness" },
      ],
    },
    {
      text: "Prompts + writing",
      items: [
        { text: "Prompt hierarchy", link: "/prompt-hierarchy" },
        { text: "Writing", link: "/writing" },
        { text: "Ledger", link: "/ledger" },
      ],
    },
  ],
});
