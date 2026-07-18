// Résolution des versets Parole de Vie : cache en base (jamais généré par l'IA),
// avec récupération bible.com (PDV2017, id 133) pour les références manquantes.

import { normalizeRef, canonicalizeRefNorm } from "./refs";
import type { Content, VerseRow } from "./types";
import { supabaseAdmin } from "./supabase";

const OSIS: Record<string, string> = {
  "genese": "GEN", "exode": "EXO", "levitique": "LEV", "nombres": "NUM", "deuteronome": "DEU",
  "josue": "JOS", "juges": "JDG", "ruth": "RUT", "1 samuel": "1SA", "2 samuel": "2SA",
  "1 rois": "1KI", "2 rois": "2KI", "1 chroniques": "1CH", "2 chroniques": "2CH",
  "esdras": "EZR", "nehemie": "NEH", "esther": "EST", "job": "JOB", "psaumes": "PSA",
  "proverbes": "PRO", "ecclesiaste": "ECC", "cantique des cantiques": "SNG",
  "esaie": "ISA", "jeremie": "JER", "lamentations": "LAM", "ezechiel": "EZK",
  "daniel": "DAN", "osee": "HOS", "joel": "JOL", "amos": "AMO", "abdias": "OBA",
  "jonas": "JON", "michee": "MIC", "nahum": "NAM", "habacuc": "HAB", "sophonie": "ZEP",
  "aggee": "HAG", "zacharie": "ZEC", "malachie": "MAL", "matthieu": "MAT", "marc": "MRK",
  "luc": "LUK", "jean": "JHN", "actes": "ACT", "romains": "ROM", "1 corinthiens": "1CO",
  "2 corinthiens": "2CO", "galates": "GAL", "ephesiens": "EPH", "philippiens": "PHP",
  "colossiens": "COL", "1 thessaloniciens": "1TH", "2 thessaloniciens": "2TH",
  "1 timothee": "1TI", "2 timothee": "2TI", "tite": "TIT", "philemon": "PHM",
  "hebreux": "HEB", "jacques": "JAS", "1 pierre": "1PE", "2 pierre": "2PE",
  "1 jean": "1JN", "2 jean": "2JN", "3 jean": "3JN", "jude": "JUD", "apocalypse": "REV",
};

function osisPath(refNorm: string): string | null {
  // "jean 8 31 32" (normalisé, livre canonisé) → "JHN.8.31-32"
  const canon = canonicalizeRefNorm(refNorm);
  const m = /^(.+?) (\d+)(?: (\d+)(?: (\d+))?)?$/.exec(canon);
  if (!m) return null;
  const book = OSIS[m[1]];
  if (!book) return null;
  if (m[3] && m[4]) return `${book}.${m[2]}.${m[3]}-${m[4]}`;
  if (m[3]) return `${book}.${m[2]}.${m[3]}`;
  return null; // chapitre seul : pas de récupération automatique
}

async function fetchPdv(refNorm: string): Promise<{ texte: string; source: string } | null> {
  const path = osisPath(refNorm);
  if (!path) return null;
  const url = `https://www.bible.com/fr/bible/133/${path}.PDV2017`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124.0" },
  });
  if (!res.ok) return null;
  const html = await res.text();
  // bible.com expose le verset dans les métadonnées de partage (og/description)
  const og =
    html.match(/<meta property="og:description" content="([^"]+)"/) ??
    html.match(/<meta name="description" content="([^"]+)"/);
  if (!og) return null;
  const texte = og[1]
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
  if (texte.length < 10) return null;
  return { texte: `« ${texte} »`, source: `vérifié en ligne — ${url}` };
}

export interface ResolveResult {
  resolus: number;
  manquants: string[];
  ajoutes: string[];
}

export async function resolveVerses(content: Content): Promise<ResolveResult> {
  const sb = supabaseAdmin();
  const rows: VerseRow[] = [];
  for (const b of content.blocks) if (b[0] === "verseTable") rows.push(...(b[1] as VerseRow[]));

  const keys = rows.map((r) => normalizeRef(r[0]));
  const { data: cached } = await sb.from("pdv_cache").select("ref_norm, texte").in("ref_norm", keys);
  const cache = new Map((cached ?? []).map((c: { ref_norm: string; texte: string }) => [c.ref_norm, c.texte]));

  const manquants: string[] = [];
  const ajoutes: string[] = [];
  let resolus = 0;

  for (const row of rows) {
    const key = normalizeRef(row[0]);
    let texte = cache.get(key);
    if (!texte) {
      const fetched = await fetchPdv(key);
      if (fetched) {
        texte = fetched.texte;
        await sb.from("pdv_cache").upsert({
          ref_norm: key,
          reference: row[0].replace(/\s*\(\*\)\s*$/, ""),
          texte: fetched.texte,
          source: fetched.source,
        });
        ajoutes.push(row[0]);
      }
    }
    if (texte) {
      row[2] = texte;
      resolus++;
    } else {
      row[2] = "À RÉSOUDRE";
      manquants.push(row[0]);
    }
  }
  return { resolus, manquants, ajoutes };
}
