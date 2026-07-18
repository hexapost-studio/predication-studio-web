// Moteur d'étapes du job : chaque appel exécute UNE étape (≤ limites Vercel),
// l'état vit en base — la page de suivi enchaîne les appels.

import { supabaseAdmin } from "./supabase";
import { ingest } from "./ingest";
import { structurer, doublePasse } from "./structurer";
import { resolveVerses } from "./verses";
import { runQa } from "./qa";
import { renderHtml, wrapLocalHtml } from "./render";
import { buildDocx } from "./docx";
import type { Content, Segment } from "./types";

export const ETAPES_LABELS: Record<string, string> = {
  ingestion: "Récupération de la prédication",
  structuration: "Structuration fidèle du message",
  versets: "Vérification de chaque verset (Parole de Vie)",
  controles: "Contrôle de fidélité",
  rendu: "Mise en page des documents",
  termine: "Terminé",
  erreur: "Erreur",
};

function slugify(titre: string): string {
  return titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type JobRow = {
  id: string;
  etape: string;
  statut: string;
  source_url: string | null;
  source_texte: string | null;
  titre: string | null;
  transcript: string | null;
  transcript_segmente: string | null;
  segments: Segment[] | null;
  contenu: Content | null;
  double_passe_faite: boolean;
};

export async function avancerJob(id: string): Promise<{ etape: string; statut: string }> {
  const sb = supabaseAdmin();
  const { data: job, error } = await sb.from("jobs").select("*").eq("id", id).single<JobRow>();
  if (error || !job) throw new Error("Job introuvable.");
  if (job.statut !== "en_cours") return { etape: job.etape, statut: job.statut };

  try {
    if (job.etape === "ingestion") {
      const res = await ingest({ url: job.source_url ?? undefined, texte: job.source_texte ?? undefined });
      await sb.from("jobs").update({
        transcript: res.transcript,
        transcript_segmente: res.transcriptSegmente,
        segments: res.segments,
        ingest_rapport: res.rapport,
        titre: job.titre ?? res.titre,
        source_texte: null, // le texte brut n'est plus utile une fois nettoyé
        etape: "structuration",
      }).eq("id", id);
      return { etape: "structuration", statut: "en_cours" };
    }

    if (job.etape === "structuration") {
      const contenu = await structurer(job.transcript_segmente!, job.titre);
      await sb.from("jobs").update({ contenu, etape: "versets" }).eq("id", id);
      return { etape: "versets", statut: "en_cours" };
    }

    if (job.etape === "versets") {
      const contenu = job.contenu!;
      await resolveVerses(contenu); // mute les lignes du tableau
      await sb.from("jobs").update({ contenu, etape: "controles" }).eq("id", id);
      return { etape: "controles", statut: "en_cours" };
    }

    if (job.etape === "controles") {
      const contenu = job.contenu!;
      const rapport = runQa(contenu, job.transcript!, job.segments ?? []);
      if (!rapport.ok && !job.double_passe_faite) {
        // Une seule passe de correction automatique, guidée par les erreurs exactes.
        const problemes = rapport.sections.flatMap((s) => s.problemes);
        const corrige = await doublePasse(contenu, problemes, job.transcript_segmente!);
        await resolveVerses(corrige);
        await sb.from("jobs").update({ contenu: corrige, rapport, double_passe_faite: true }).eq("id", id);
        return { etape: "controles", statut: "en_cours" };
      }
      if (!rapport.ok) {
        await sb.from("jobs").update({
          rapport, statut: "erreur", etape: "erreur",
          message_erreur: "Les contrôles de fidélité n'ont pas pu être tous validés — voir le rapport.",
        }).eq("id", id);
        return { etape: "erreur", statut: "erreur" };
      }
      await sb.from("jobs").update({ rapport, etape: "rendu" }).eq("id", id);
      return { etape: "rendu", statut: "en_cours" };
    }

    if (job.etape === "rendu") {
      const contenu = job.contenu!;
      const inner = renderHtml(contenu);
      const html = wrapLocalHtml(inner, contenu.meta.titre);
      const docx = await buildDocx(contenu);
      const base = slugify(contenu.meta.titre) || "etude";
      let slug = base;
      for (let i = 2; ; i++) {
        const { data } = await sb.from("etudes").select("slug").eq("slug", slug).maybeSingle();
        if (!data) break;
        slug = `${base}-${i}`;
      }
      const nbVersets = contenu.blocks
        .filter((b) => b[0] === "verseTable")
        .reduce((n, b) => n + (b[1] as unknown[]).length, 0);
      const { data: rapportRow } = await sb.from("jobs").select("rapport").eq("id", id).single();
      const nbIncert = JSON.stringify(contenu.blocks).match(/\[\?[^\]]+\]/g)?.length ?? 0;
      const { error: insErr } = await sb.from("etudes").insert({
        slug,
        titre: contenu.meta.titre,
        orateur: contenu.meta.meta_items.find(([k]) => k.toLowerCase() === "orateur")?.[1] ?? "",
        occasion: contenu.meta.meta_items.find(([k]) => k.toLowerCase() !== "orateur")?.[1] ?? "",
        theme: contenu.meta.theme,
        favicon: contenu.meta.favicon,
        html,
        docx_base64: docx.toString("base64"),
        rapport: rapportRow?.rapport ?? null,
        nb_versets: nbVersets,
        nb_incertitudes: nbIncert,
        job_id: id,
      });
      if (insErr) throw new Error(`Publication impossible : ${insErr.message}`);
      await sb.from("jobs").update({ etape: "termine", statut: "termine", etude_slug: slug }).eq("id", id);
      return { etape: "termine", statut: "termine" };
    }

    return { etape: job.etape, statut: job.statut };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sb.from("jobs").update({ statut: "erreur", etape: "erreur", message_erreur: message }).eq("id", id);
    return { etape: "erreur", statut: "erreur" };
  }
}
