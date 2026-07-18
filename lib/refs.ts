// Normalisation et détection des références bibliques.
// Port TypeScript des fonctions de qa_check.py + livres-bibliques.txt.

const LIVRES: string[][] = [
  ["genèse", "genese"], ["exode"], ["lévitique", "levitique"], ["nombres"],
  ["deutéronome", "deuteronome"], ["josué", "josue"], ["juges"], ["ruth"],
  ["1 samuel", "premier samuel"], ["2 samuel", "deuxième samuel", "deuxieme samuel"],
  ["1 rois", "premier rois"], ["2 rois", "deuxième rois", "deuxieme rois"],
  ["1 chroniques", "1 chronique", "premier chroniques", "premier chronique"],
  ["2 chroniques", "2 chronique", "deuxième chroniques", "deuxieme chronique"],
  ["esdras"], ["néhémie", "nehemie"], ["esther"], ["job"],
  ["psaumes", "psaume"], ["proverbes", "proverbe"], ["ecclésiaste", "ecclesiaste"],
  ["cantique des cantiques", "cantique"],
  ["ésaïe", "esaïe", "esaie", "isaïe", "isaie"], ["jérémie", "jeremie"],
  ["lamentations"], ["ézéchiel", "ezechiel", "ezéchiel"], ["daniel"],
  ["osée", "osee"], ["joël", "joel"], ["amos"], ["abdias"], ["jonas"],
  ["michée", "michee"], ["nahum"], ["habacuc"], ["sophonie"], ["aggée", "aggee"],
  ["zacharie"], ["malachie"],
  ["matthieu"], ["marc"], ["luc"], ["jean"],
  ["actes", "actes des apôtres", "actes des apotres"], ["romains", "romain"],
  ["1 corinthiens", "1 corinthien", "premier corinthiens", "première aux corinthiens"],
  ["2 corinthiens", "2 corinthien", "deuxième corinthiens", "deuxieme corinthiens"],
  ["galates", "galate"], ["éphésiens", "ephesiens", "éphésien", "ephésiens"],
  ["philippiens", "philippien"], ["colossiens", "colossien"],
  ["1 thessaloniciens", "premier thessaloniciens", "1 thessalonicien"],
  ["2 thessaloniciens", "deuxième thessaloniciens", "2 thessalonicien"],
  ["1 timothée", "1 timothee", "premier timothée"], ["2 timothée", "2 timothee", "deuxième timothée"],
  ["tite"], ["philémon", "philemon"], ["hébreux", "hebreux"], ["jacques"],
  ["1 pierre", "premier pierre"], ["2 pierre", "deuxième pierre", "deuxieme pierre"],
  ["1 jean", "premier jean"], ["2 jean", "deuxième jean", "deuxieme jean"],
  ["3 jean", "troisième jean", "troisieme jean"], ["jude"], ["apocalypse"],
];

export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRef(ref: string): string {
  return norm(ref.replace(/\s*\(\*\)\s*$/, ""));
}

const variantToCanonical = new Map<string, string>();
for (const variants of LIVRES) {
  const canonical = norm(variants[0]);
  for (const v of variants) variantToCanonical.set(norm(v), canonical);
}
const ALTERNATION = [...variantToCanonical.keys()]
  .sort((a, b) => b.length - a.length)
  .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

export type RefBase = string; // "canonique chapitre", ex. "jacques 5"

/** Remplace le nom de livre (variante) en tête d'une référence normalisée par sa forme canonique. */
export function canonicalizeRefNorm(refNorm: string): string {
  for (const [variant, canonical] of [...variantToCanonical.entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (refNorm.startsWith(variant + " ")) {
      return canonical + refNorm.slice(variant.length);
    }
  }
  return refNorm;
}

export function parseRefBases(text: string): Set<RefBase> {
  const bases = new Set<RefBase>();
  const re = new RegExp(`\\b(${ALTERNATION}) (\\d+)`, "g");
  for (const m of norm(text).matchAll(re)) {
    bases.add(`${variantToCanonical.get(m[1])} ${parseInt(m[2], 10)}`);
  }
  return bases;
}

export function detectTranscriptBases(transcript: string): Set<RefBase> {
  const bases = new Set<RefBase>();
  const re = new RegExp(`\\b(${ALTERNATION}) (?:chapitre (\\d+)|(\\d+) verset \\d+)`, "g");
  for (const m of norm(transcript).matchAll(re)) {
    const chap = m[2] ?? m[3];
    bases.add(`${variantToCanonical.get(m[1])} ${parseInt(chap, 10)}`);
  }
  return bases;
}
