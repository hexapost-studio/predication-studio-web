import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { avancerJob, ETAPES_LABELS } from "@/lib/jobs";

export const maxDuration = 300; // la structuration IA peut durer plusieurs minutes

/** Réponse compatible avec la forme attendue par la page de suivi (EtatJob),
 *  pour que toute panne côté serveur s'affiche dans le même bandeau d'erreur
 *  que les échecs métier normaux, sans changement côté client. */
function reponseErreur(message: string, status: number) {
  return NextResponse.json(
    {
      etape: "erreur",
      statut: "erreur",
      titre: null,
      message_erreur: message,
      etude_slug: null,
      rapport: null,
      label: ETAPES_LABELS["erreur"],
    },
    { status }
  );
}

const MESSAGE_CONFIG_MANQUANTE =
  "Le site n'est pas encore configuré (base de données manquante). " +
  "Vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans votre fichier .env.local.";
const MESSAGE_DB_INJOIGNABLE = "Impossible de contacter la base de données. Réessayez dans un instant.";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let sb;
  try {
    sb = supabaseAdmin();
  } catch {
    return reponseErreur(MESSAGE_CONFIG_MANQUANTE, 503);
  }

  try {
    const { data: job, error } = await sb
      .from("jobs")
      .select("etape, statut, titre, message_erreur, rapport, etude_slug, ingest_rapport")
      .eq("id", id)
      .maybeSingle();
    if (error) return reponseErreur(MESSAGE_DB_INJOIGNABLE, 503);
    if (!job) return NextResponse.json({ erreur: "Job introuvable." }, { status: 404 });
    return NextResponse.json({ ...job, label: ETAPES_LABELS[job.etape] ?? job.etape });
  } catch {
    return reponseErreur(MESSAGE_DB_INJOIGNABLE, 503);
  }
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const res = await avancerJob(id);
    return NextResponse.json(res);
  } catch (e) {
    // avancerJob() capture déjà les erreurs d'étape ; on n'arrive ici que si
    // Supabase lui-même est mal configuré ou injoignable (avant son propre try/catch).
    const message = e instanceof Error ? e.message : String(e);
    const configManquante = /manquant/i.test(message);
    return reponseErreur(configManquante ? MESSAGE_CONFIG_MANQUANTE : MESSAGE_DB_INJOIGNABLE, 503);
  }
}
