// Récupération de sous-titres YouTube via youtubei.js (pur JS, aucun binaire) :
// passe par l'endpoint InnerTube get_transcript (celui du panneau natif « Afficher
// la transcription » de YouTube), un chemin distinct du baseUrl signé des
// captionTracks qui échoue désormais avec un corps vide (jeton anti-robot requis).
// Fonctionne aussi bien en local que sur un déploiement serverless (Vercel).
import { Innertube } from "youtubei.js";

let innertube: Innertube | null = null;
async function client(): Promise<Innertube> {
  if (!innertube) innertube = await Innertube.create({ lang: "fr", location: "FR" });
  return innertube;
}

function estSegmentTexte(node: unknown): node is { snippet?: { toString(): string }; target_id?: string } {
  // TranscriptSegment a `target_id` ; TranscriptSectionHeader (à ignorer) ne l'a pas.
  return typeof node === "object" && node !== null && "target_id" in node;
}

/** Tente jusqu'à 3 fois (l'endpoint get_transcript renvoie parfois un 400
 *  intermittent, documenté et non résolu côté youtubei.js) avant d'abandonner. */
export async function fetchViaYoutubei(
  videoId: string
): Promise<{ titre: string | null; texte: string } | null> {
  let derniereErreur: unknown = null;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const yt = await client();
      const info = await yt.getInfo(videoId);
      const titre = info.basic_info?.title ?? null;

      let transcriptInfo = await info.getTranscript();
      const langueFr = transcriptInfo.languages.find((l) => l.toLowerCase().startsWith("fr"));
      if (langueFr && transcriptInfo.selectedLanguage !== langueFr) {
        transcriptInfo = await transcriptInfo.selectLanguage(langueFr);
      }

      const segments = transcriptInfo.transcript.content?.body?.initial_segments ?? [];
      const texte = segments
        .filter(estSegmentTexte)
        .map((s) => s.snippet?.toString().trim() ?? "")
        .filter(Boolean)
        .join(" ");
      if (!texte) return null;
      return { titre, texte };
    } catch (e) {
      derniereErreur = e;
      if (essai < 3) await new Promise((r) => setTimeout(r, 1200 * essai));
    }
  }
  void derniereErreur; // best-effort : la cascade appelante gère l'échec final
  return null;
}
