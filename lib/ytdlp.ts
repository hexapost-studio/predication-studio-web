// Récupération de sous-titres YouTube via yt-dlp local, si le binaire est présent.
// Optionnel : absent en environnement serverless (Vercel), ce module se contente
// alors de signaler son absence (ENOENT) — lib/ingest.ts retombe sur les méthodes
// suivantes de la cascade. Jamais invoqué via un shell : l'URL/l'id utilisateur ne
// transitent jamais dans une chaîne interprétée.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 55_000; // sous la limite de 60s de la route /api/jobs (étape ingestion)

export async function ytDlpDisponible(): Promise<boolean> {
  try {
    await execFileAsync("yt-dlp", ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/** Exportée pour scripts/test-robustesse.ts (parsing pur, aucun appel réseau/binaire). */
export function nettoyerVtt(vtt: string): string {
  const lignes = vtt.split(/\r?\n/);
  const texte: string[] = [];
  let precedente = "";
  for (const ligne of lignes) {
    if (
      !ligne.trim() ||
      ligne.startsWith("WEBVTT") ||
      ligne.startsWith("Kind:") ||
      ligne.startsWith("Language:") ||
      /-->/.test(ligne) ||
      /^\d+$/.test(ligne.trim())
    ) {
      continue;
    }
    // Sous-titres auto-générés : balises de karaoké <00:00:01.234><c> mot </c>
    const nettoyee = ligne.replace(/<[^>]+>/g, "").trim();
    if (nettoyee && nettoyee !== precedente) {
      texte.push(nettoyee);
      precedente = nettoyee;
    }
  }
  return texte.join(" ");
}

/** Retourne null (jamais une exception) si yt-dlp est absent ou échoue — la
 *  cascade dans lib/ingest.ts décide de la suite, ce module ne fait que constater. */
export async function fetchViaYtDlp(
  videoId: string
): Promise<{ titre: string | null; texte: string } | null> {
  if (!(await ytDlpDisponible())) return null;

  const dossier = await mkdtemp(join(tmpdir(), "predication-ytdlp-"));
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // Deux appels distincts : combiner --print title avec --write-subs dans le
    // même appel fait sortir yt-dlp après l'impression du titre, SANS écrire les
    // sous-titres (constaté empiriquement — bug d'interaction entre ces deux
    // options, pas un problème réseau). Le titre coûte peu à récupérer à part.
    await execFileAsync(
      "yt-dlp",
      [
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "fr,fr-orig,fr-FR,fr.*",
        "--sub-format",
        "vtt",
        "--no-warnings",
        "-o",
        "video.%(ext)s",
        "--paths",
        dossier,
        url,
      ],
      { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );

    let titre: string | null = null;
    try {
      const { stdout } = await execFileAsync(
        "yt-dlp",
        ["--skip-download", "--simulate", "--no-warnings", "--print", "title", url],
        { timeout: 15_000 }
      );
      titre = stdout.split(/\r?\n/)[0]?.trim() || null;
    } catch {
      // Le titre est un confort, pas un blocant : la structuration en déduit un si absent.
    }

    const fichiers = await readdir(dossier);
    const vttFichier =
      fichiers.find((f) => /\.fr\.vtt$/.test(f)) ??
      fichiers.find((f) => /\.fr[-.].*\.vtt$/.test(f)) ??
      fichiers.find((f) => f.endsWith(".vtt"));
    if (!vttFichier) return null;

    const vtt = await readFile(join(dossier, vttFichier), "utf8");
    const texte = nettoyerVtt(vtt);
    if (!texte) return null;
    return { titre, texte };
  } catch {
    return null;
  } finally {
    await rm(dossier, { recursive: true, force: true }).catch(() => {});
  }
}
