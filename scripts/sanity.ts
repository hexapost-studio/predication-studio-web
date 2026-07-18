// Test de cohérence : les ports TypeScript doivent reproduire les verdicts du
// pipeline Python sur le corpus étalon J2 (QA 5/5 vert, rendus non vides).
// Usage : node scripts/sanity.ts <content.json résolu> <transcript.txt> <segments.json>
import { readFileSync } from "fs";
import { runQa } from "../lib/qa";
import { renderHtml } from "../lib/render";
import { buildDocx } from "../lib/docx";
import type { Content, Segment } from "../lib/types";

const [contentPath, transcriptPath, segmentsPath] = process.argv.slice(2);
const content = JSON.parse(readFileSync(contentPath, "utf8")) as Content;
const transcript = readFileSync(transcriptPath, "utf8");
const segments = JSON.parse(readFileSync(segmentsPath, "utf8")) as Segment[];

const rapport = runQa(content, transcript, segments);
for (const s of rapport.sections) {
  console.log(`${s.problemes.length ? "✗" : "✓"} ${s.nom}`);
  for (const p of s.problemes) console.log(`    ${p}`);
}

const html = renderHtml(content);
console.log(`HTML : ${html.length} caractères, ${(html.match(/<tr>/g) ?? []).length} lignes de tableau`);

buildDocx(content).then((docx) => {
  console.log(`DOCX : ${docx.length} octets`);
  if (!rapport.ok) process.exit(1);
  console.log("SANITY OK");
});
