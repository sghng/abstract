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
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Repertoire", link: "/repertoire/" },
      { text: "Harness", link: "/multi-agent" },
      { text: "Prompts", link: "/prompt-hierarchy" },
    ],
    sidebar: [
      {
        text: "Repertoire manual",
        items: [
          { text: "Overview + spec", link: "/repertoire/" },
          { text: "Fetch layer", link: "/repertoire/fetch" },
          { text: "Parse layer", link: "/repertoire/parse" },
          { text: "Parse report (ledger)", link: "/repertoire/parse-report" },
          { text: "Build history", link: "/repertoire/history" },
        ],
      },
      {
        text: "Harness",
        items: [
          { text: "Multi-agent pattern", link: "/multi-agent" },
          { text: "Implementation plan", link: "/harness" },
          { text: "Desk", link: "/desk" },
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
  },
});
