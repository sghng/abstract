import { defineConfig } from "vitepress";

// Local manual site. Not deployed: run `bun run docs:dev` and open the
// printed localhost URL. docs/repertoire/ is the corpus manual
// (rebuild-from-zero reference); the docs root holds design docs and the
// dated explorations.
export default defineConfig({
  title: "abstract",
  description: "Research doctrine + repertoire manual",
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
      { text: "typ2docx", link: "/typ2docx" },
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
        text: "Design + explorations",
        items: [
          { text: "typ2docx", link: "/typ2docx" },
          { text: "Prompting (2026-10-11)", link: "/prompting-2026-10-11" },
          { text: "Stylometer", link: "/stylometer" },
          { text: "Session audit (q-matrix)", link: "/session-audit-qmatrix-rnr" },
        ],
      },
    ],
  },
});
