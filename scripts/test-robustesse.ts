// Test de non-régression : reproduit les formes déviantes réellement observées avec
// des modèles gratuits/faibles (voir commit "Durcit l'app contre les configs
// dégradées…") et vérifie que le code de correction les absorbe sans planter.
// Ne fait AUCUN appel réseau (LLM, Supabase) : uniquement les fonctions pures.
// Usage : npx tsx scripts/test-robustesse.ts
import assert from "node:assert/strict";
import { normaliser, estValide, parseJson } from "../lib/structurer";
import { coerceVerseRows } from "../lib/verses";
import { nettoyerVtt } from "../lib/ytdlp";
import type { Content } from "../lib/types";

let ok = 0;
let total = 0;

function test(nom: string, fn: () => void) {
  total++;
  try {
    fn();
    ok++;
    console.log(`✓ ${nom}`);
  } catch (e) {
    console.log(`✗ ${nom}`);
    console.log(`    ${e instanceof Error ? e.message : String(e)}`);
  }
}

// --- normaliser() / estValide() : formes déviantes réellement vues avec un modèle gratuit ---

test("forme correcte {meta:{titre},blocks:[]} reste valide", () => {
  const c = normaliser({ meta: { titre: "T" }, blocks: [["p", "x"]] });
  assert.equal(estValide(c), true);
});

test("titre/content à plat (vu en prod sur nemotron:free) est corrigé", () => {
  const c = normaliser({ titre: "T", content: [["p", "x"]] });
  assert.equal(estValide(c), true);
  assert.equal(c.meta.titre, "T");
});

test("clé 'corps' au lieu de 'blocks' est acceptée", () => {
  const c = normaliser({ meta: { titre: "T" }, corps: [["p", "x"]] });
  assert.equal(estValide(c), true);
});

test("blocks totalement absent → invalide (pas de correction inventée)", () => {
  const c = normaliser({ titre: "T" });
  assert.equal(estValide(c), false);
});

test("titre manquant → invalide même si blocks présent", () => {
  const c = normaliser({ blocks: [["p", "x"]] });
  assert.equal(estValide(c), false);
});

test("parseJson() accepte un bloc ```json fences```", () => {
  const data = parseJson('```json\n{"meta":{"titre":"T"},"blocks":[]}\n```');
  assert.equal((data as Content).meta.titre, "T");
});

test("parseJson() rejette un JSON invalide", () => {
  assert.throws(() => parseJson("pas du json"));
});

// --- coerceVerseRows() : ligne de tableau de versets malformée (vu en prod) ---

test("ligne de verseTable normale reste inchangée", () => {
  const blocks: Content["blocks"] = [["verseTable", [["Jean 3:16", "point", ""]], ""]];
  const rows = coerceVerseRows(blocks);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], "Jean 3:16");
});

test("référence non-string (nombre) est forcée en texte plutôt que de planter", () => {
  const blocks = [["verseTable", [[316, "point", ""]], ""]] as unknown as Content["blocks"];
  const rows = coerceVerseRows(blocks);
  assert.equal(rows.length, 1);
  assert.equal(typeof rows[0][0], "string");
});

test("référence null/undefined devient un texte lisible", () => {
  const blocks = [["verseTable", [[null, "point", ""]], ""]] as unknown as Content["blocks"];
  const rows = coerceVerseRows(blocks);
  assert.equal(rows[0][0], "(référence illisible)");
});

test("ligne qui n'est pas un tableau est ignorée sans planter", () => {
  const blocks = [["verseTable", ["pas une ligne", ["Jean 3:16", "point", ""]], ""]] as unknown as Content["blocks"];
  const rows = coerceVerseRows(blocks);
  assert.equal(rows.length, 1);
});

test("blocks sans aucun verseTable → tableau vide, pas d'erreur", () => {
  const blocks: Content["blocks"] = [["p", "x"]];
  assert.deepEqual(coerceVerseRows(blocks), []);
});

// --- nettoyerVtt() : parsing des fichiers .vtt produits par yt-dlp ---

test("nettoyerVtt() retire l'en-tête, les timestamps et les doublons consécutifs", () => {
  const vtt = [
    "WEBVTT",
    "Kind: captions",
    "Language: fr",
    "",
    "00:00:01.000 --> 00:00:03.000",
    "Bonjour à tous",
    "",
    "00:00:03.000 --> 00:00:05.000",
    "Bonjour à tous",
    "merci d'être venus",
  ].join("\n");
  assert.equal(nettoyerVtt(vtt), "Bonjour à tous merci d'être venus");
});

test("nettoyerVtt() retire les balises de karaoké des sous-titres auto-générés", () => {
  const vtt = [
    "WEBVTT",
    "",
    "00:00:01.000 --> 00:00:03.000",
    "<00:00:01.200><c>Bonjour</c> <00:00:01.500><c>à</c> <00:00:01.800><c>tous</c>",
  ].join("\n");
  assert.equal(nettoyerVtt(vtt), "Bonjour à tous");
});

test("nettoyerVtt() sur un fichier vide renvoie une chaîne vide (pas une exception)", () => {
  assert.equal(nettoyerVtt(""), "");
});

console.log(`\n${ok}/${total} tests passés`);
if (ok !== total) process.exit(1);
console.log("ROBUSTESSE OK");
