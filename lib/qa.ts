// Portes de qualité — port TypeScript de scripts/qa_check.py.
// Toutes bloquantes : le document n'est jamais publié si une section échoue.

import type { Content, QaReport, QaSection, Segment, VerseRow } from "./types";
import { norm, normalizeRef, parseRefBases, detectTranscriptBases } from "./refs";

const MOTS_BANNIS = [
  "doctrin", "patholog", "kpi", "key performance", "so what",
  "connective tissue", "analyse de contexte", "retro ingenierie",
  "neuro ergonomie spirituelle", "licence d exploitation", "spermatozoides spirituels",
];
const MIN_QUOTE_WORDS = 5;
const MATCH_WINDOW = 0.7;

function bodyText(content: Content): string {
  const parts: string[] = [];
  for (const b of content.blocks) {
    if (b[0] === "p" || b[0] === "bullet" || b[0] === "bullet2" || b[0] === "reserve") {
      parts.push(b[1] as string);
    } else if (b[0] === "quote") {
      parts.push(b[1] as string, b[2] as string);
    } else if (b[0] === "h2") {
      parts.push(b[1] as string);
    } else if (b[0] === "box") {
      parts.push(b[1] as string, ...(b[2] as string[]));
    }
  }
  return parts.join("\n");
}

function tableRows(content: Content): VerseRow[] {
  const rows: VerseRow[] = [];
  for (const b of content.blocks) {
    if (b[0] === "verseTable") rows.push(...(b[1] as VerseRow[]));
  }
  return rows;
}

export function marqueursIncertitude(content: Content): string[] {
  const out: string[] = [];
  for (const m of bodyText(content).matchAll(/\[\?([^\]]+)\]/g)) {
    out.push(`[?…] : « ${m[1].slice(0, 60)} »`);
  }
  for (const b of content.blocks) {
    if (b[0] === "reserve") out.push(`bloc réserve : « ${(b[1] as string).slice(0, 60)} »`);
  }
  return out;
}

function checkBannis(content: Content): QaSection {
  const haystack = norm(JSON.stringify(content));
  const problemes = MOTS_BANNIS.filter((p) => haystack.includes(p)).map(
    (p) => `vocabulaire proscrit détecté : « ${p} »`
  );
  return { nom: "Vocabulaire", problemes, infos: [] };
}

function checkVersets(content: Content, transcript: string): QaSection {
  const problemes: string[] = [];
  const infos: string[] = [];
  const rows = tableRows(content);
  const transcriptBases = detectTranscriptBases(transcript);

  if (!rows.length) {
    if (!transcriptBases.size) return { nom: "Versets", problemes: [], infos: ["aucune référence biblique détectée — tableau légitimement absent"] };
    return {
      nom: "Versets",
      problemes: [`aucun tableau de versets alors que le transcript en cite : ${[...transcriptBases].sort().join(", ")}`],
      infos: [],
    };
  }

  const tableBases = new Set<string>();
  for (const row of rows) {
    const bases = parseRefBases(normalizeRef(row[0]));
    if (!bases.size) problemes.push(`référence du tableau non reconnue : ${row[0]}`);
    bases.forEach((b) => tableBases.add(b));
    if (!row[2]?.trim() || row[2].trim() === "À RÉSOUDRE") {
      problemes.push(`texte Parole de Vie manquant : ${row[0]}`);
    }
  }

  const bodyBases = new Set<string>();
  for (const m of bodyText(content).matchAll(/\[\[([^\]]+)\]\]/g)) {
    const bases = parseRefBases(m[1]);
    if (!bases.size) problemes.push(`référence du corps non reconnue : ${m[1]}`);
    bases.forEach((b) => bodyBases.add(b));
  }

  for (const b of [...bodyBases].sort()) {
    if (!tableBases.has(b)) problemes.push(`référence citée dans le texte mais absente du tableau : ${b}`);
  }
  for (const b of [...tableBases].sort()) {
    if (!bodyBases.has(b)) problemes.push(`ligne du tableau jamais citée dans le texte : ${b}`);
  }

  const exceptions = new Map<string, string>();
  for (const exc of content.meta.recall_exceptions ?? []) {
    parseRefBases(exc.base).forEach((b) => exceptions.set(b, exc.raison));
  }
  for (const [b, raison] of exceptions) {
    if (transcriptBases.has(b)) infos.push(`exception déclarée : ${b} — ${raison}`);
  }
  for (const b of [...transcriptBases].sort()) {
    if (!tableBases.has(b) && !exceptions.has(b)) {
      problemes.push(`référence entendue dans la prédication mais absente du tableau : ${b}`);
    }
  }
  return { nom: "Versets", problemes, infos };
}

function checkCitations(content: Content, transcript: string): QaSection {
  const problemes: string[] = [];
  const tnorm = norm(transcript);
  for (const m of bodyText(content).matchAll(/«\s*([^»]+?)\s*»/g)) {
    const brut = m[1];
    const aMarqueur = brut.includes("[?");
    const clean = brut.replace(/\[\?([^\]]+)\]/g, "$1");
    const words = norm(clean).split(" ").filter(Boolean);
    if (words.length < MIN_QUOTE_WORDS) continue;
    const ratio = aMarqueur ? 0.5 : MATCH_WINDOW;
    const window = Math.max(MIN_QUOTE_WORDS, Math.floor(words.length * ratio));
    let found = false;
    for (let i = 0; i + window <= words.length; i++) {
      if (tnorm.includes(words.slice(i, i + window).join(" "))) {
        found = true;
        break;
      }
    }
    if (!found) problemes.push(`citation introuvable dans le transcript : « ${clean.slice(0, 80)}… »`);
  }
  return { nom: "Citations", problemes, infos: [] };
}

function checkTracabilite(content: Content, segments: Segment[]): QaSection {
  const total = segments.length ? Math.max(...segments.map((s) => s.id)) : 0;
  if (!total) return { nom: "Couverture", problemes: ["segments du transcript manquants"], infos: [] };
  const covered = new Set<number>();
  let declared = 0;
  for (const b of content.blocks) {
    if (b[0] === "h2" && b[2] && typeof b[2] === "object" && b[2].segments) {
      declared++;
      const [start, end] = b[2].segments;
      for (let i = start; i <= end; i++) covered.add(i);
    }
  }
  if (!declared) return { nom: "Couverture", problemes: ["aucune section ne déclare sa couverture du transcript"], infos: [] };
  const missing: number[] = [];
  for (let i = 1; i <= total; i++) if (!covered.has(i)) missing.push(i);
  if (missing.length) {
    return {
      nom: "Couverture",
      problemes: [`passages du transcript non couverts par le document : §${missing.join(", §")} (sur ${total})`],
      infos: [],
    };
  }
  return { nom: "Couverture", problemes: [], infos: [`${total} segments du transcript, tous couverts`] };
}

export function runQa(content: Content, transcript: string, segments: Segment[]): QaReport {
  const incertitudes = marqueursIncertitude(content);
  const sections: QaSection[] = [
    checkBannis(content),
    checkVersets(content, transcript),
    checkCitations(content, transcript),
    {
      nom: "Fiabilité déclarée",
      problemes: [],
      infos: incertitudes.length
        ? [`${incertitudes.length} passage(s) marqué(s) incertain(s), signalés au lecteur`, ...incertitudes]
        : ["aucun passage incertain : contenu 100 % vérifié"],
    },
    checkTracabilite(content, segments),
  ];
  return { sections, ok: sections.every((s) => s.problemes.length === 0) };
}
