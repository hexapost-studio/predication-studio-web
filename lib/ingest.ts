// Ingestion : lien YouTube ou texte collé/fichier (export NotebookLM, transcript brut).
// Port TypeScript de scripts/ingest.py du repo predication-studio.
//
// Sous-titres YouTube récupérés en cascade (chaque étape ne s'exécute que si la
// précédente a échoué) : yt-dlp local si présent (le plus fiable, mais binaire
// optionnel absent en serverless) → youtubei.js (pur JS, aucun binaire, marche
// aussi sur Vercel) → fetch() direct du baseUrl signé (historique, cassé sur la
// plupart des vidéos depuis que YouTube exige un jeton anti-robot pour le servir,
// conservé en dernier filet automatique car gratuit à tenter) → message invitant
// à coller le transcript à la main (seule méthode garantie à 100%).

import type { Segment } from "./types";
import { fetchViaYtDlp } from "./ytdlp";
import { fetchViaYoutubei } from "./youtubei-transcript";

export const SEGMENT_WORDS = 200;

export interface IngestResult {
  transcript: string;            // texte continu nettoyé
  transcriptSegmente: string;    // avec marqueurs [§N]
  segments: Segment[];
  rapport: string[];
}

function stripNotebooklmHeader(text: string): string {
  const lines = text.split(/\r?\n/);
  while (
    lines.length &&
    (lines[0].startsWith("#") ||
      !lines[0].trim() ||
      /^-{2,}\s*$/.test(lines[0]) ||
      /^(Exporté|Exported|Source|Date|exported:|source:|type:|title:)/i.test(lines[0]) ||
      /^[一-鿿]/.test(lines[0]))
  ) {
    lines.shift();
  }
  return lines.join("\n");
}

function stripTimestamps(text: string): string {
  // [MM:SS] / (H:MM:SS) toujours retirés ; H:MM:SS nu aussi (deux deux-points).
  // « Jean 3:16 » (un seul deux-points, hors crochets) est préservé.
  return text
    .replace(/[[(]\s*\d{1,2}:\d{2}(?::\d{2})?\s*[\])]/g, " ")
    .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, " ");
}

export function nettoyerTexte(brut: string): string {
  let t = stripNotebooklmHeader(brut);
  t = stripTimestamps(t);
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^[-•]\s*/, "");
  return t;
}

export function segmenter(transcript: string): { segments: Segment[]; segmente: string } {
  const mots = transcript.split(" ");
  const segments: Segment[] = [];
  const parts: string[] = [];
  for (let i = 0; i < mots.length; i += SEGMENT_WORDS) {
    const id = Math.floor(i / SEGMENT_WORDS) + 1;
    const chunk = mots.slice(i, i + SEGMENT_WORDS);
    segments.push({ id, apercu: chunk.slice(0, 8).join(" ") + "…" });
    parts.push(`[§${id}] ` + chunk.join(" "));
  }
  return { segments, segmente: parts.join(" ") };
}

// ---- Sous-titres YouTube ----

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
}

export async function fetchYoutube(
  url: string
): Promise<{ titre: string | null; texte: string; methode: string }> {
  const id = youtubeId(url);
  if (!id) throw new Error("Lien YouTube non reconnu.");

  const viaYtDlp = await fetchViaYtDlp(id);
  if (viaYtDlp) return { ...viaYtDlp, methode: "yt-dlp local" };

  const viaYoutubei = await fetchViaYoutubei(id);
  if (viaYoutubei) return { ...viaYoutubei, methode: "youtubei.js" };

  const viaFetch = await fetchDirect(id);
  return { ...viaFetch, methode: "fetch direct" };
}

async function fetchDirect(id: string): Promise<{ titre: string | null; texte: string }> {
  const page = await fetch(`https://www.youtube.com/watch?v=${id}&hl=fr`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "accept-language": "fr-FR,fr;q=0.9",
    },
  });
  if (!page.ok) throw new Error(`YouTube a répondu ${page.status}.`);
  const html = await page.text();

  const titreMatch = html.match(/<title>([^<]*)<\/title>/);
  const titre = titreMatch
    ? titreMatch[1].replace(/\s*-\s*YouTube\s*$/, "").trim()
    : null;

  const capMatch = html.match(/"captionTracks":(\[[^\]]*\])/);
  if (!capMatch) {
    throw new Error(
      "Aucun sous-titre trouvé pour cette vidéo. Vous pouvez coller le transcript en texte à la place."
    );
  }
  const tracks: CaptionTrack[] = JSON.parse(capMatch[1]);
  const fr =
    tracks.find((t) => t.languageCode === "fr" && t.kind !== "asr") ||
    tracks.find((t) => t.languageCode?.startsWith("fr")) ||
    null;
  if (!fr) {
    throw new Error(
      "Pas de sous-titres français sur cette vidéo. Vous pouvez coller le transcript en texte à la place."
    );
  }
  const xmlRes = await fetch(fr.baseUrl.replace(/&fmt=\w+/, ""));
  if (!xmlRes.ok) throw new Error(`Impossible de récupérer les sous-titres (${xmlRes.status}).`);
  const xml = await xmlRes.text();

  const texts: string[] = [];
  let prev = "";
  for (const m of xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)) {
    const line = decodeEntities(m[1]).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (line && line !== prev) {
      texts.push(line);
      prev = line;
    }
  }
  if (!texts.length) {
    // Dernier maillon de la cascade (yt-dlp et youtubei.js ont déjà été tentés et
    // ont échoué avant d'arriver ici) : YouTube exige de plus en plus souvent un
    // jeton anti-robot pour servir le contenu des sous-titres par cette méthode
    // historique (la requête réussit — HTTP 200 — mais renvoie un corps vide).
    // Plus rien à tenter automatiquement : orienter vers le collage manuel, la
    // seule méthode garantie à 100%.
    throw new Error(
      "YouTube n'a pas transmis le contenu des sous-titres pour ce lien, malgré plusieurs méthodes " +
        "essayées automatiquement (protection anti-robot de leur côté, indépendante de cette " +
        "installation). Utilisez le raccourci « Copier la prédication » ci-dessus depuis la page " +
        "YouTube, ou collez le transcript autrement (sous-titres copiés à la main, export NotebookLM) " +
        "dans le champ texte à la place du lien."
    );
  }
  return { titre, texte: texts.join(" ") };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export async function ingest(input: { url?: string; texte?: string }): Promise<IngestResult & { titre: string | null }> {
  const rapport: string[] = [];
  let brut = "";
  let titre: string | null = null;
  if (input.url) {
    const yt = await fetchYoutube(input.url);
    brut = yt.texte;
    titre = yt.titre;
    rapport.push(`sous-titres YouTube récupérés via ${yt.methode} (${brut.length} caractères)`);
  } else if (input.texte) {
    brut = input.texte;
    rapport.push(`texte fourni (${brut.length} caractères)`);
  } else {
    throw new Error("Aucune source fournie.");
  }
  const transcript = nettoyerTexte(brut);
  const mots = transcript.split(" ").length;
  if (mots < 200) {
    throw new Error("Le transcript est trop court pour être une prédication (moins de 200 mots).");
  }
  const { segments, segmente } = segmenter(transcript);
  rapport.push(`transcript final : ${mots} mots, ${segments.length} segments`);
  return { transcript, transcriptSegmente: segmente, segments, rapport, titre };
}
