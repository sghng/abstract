// probe: verify old parseIssue logic against a cached 1936 issue page
const html = await Bun.file(
  new URL("./issue-cache/issue-9E876DB8EDE21C176CD5061A3DB22A62.html", import.meta.url).pathname,
).text();

function decodeEntities(s: string): string {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

const linkRe =
  /<a class="part-link" href="(\/core\/journals\/psychometrika\/article\/[a-z0-9-]+\/[A-Z0-9]+)">([\s\S]*?)<\/a>/g;
const matches = [...html.matchAll(linkRe)];
console.log("part-link matches:", matches.length);
for (let k = 0; k < matches.length; k++) {
  const [, href, rawTitle] = matches[k];
  const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  const start = matches[k].index! + matches[k][0].length;
  const end = k + 1 < matches.length ? matches[k + 1].index! : html.length;
  const block = html.slice(start, end);
  const doi = block.match(/data-doi="(10\.\d{4,}\/[^"]+)"/i)?.[1];
  console.log("-", doi ?? "(none)", "|", title.slice(0, 70));
}
