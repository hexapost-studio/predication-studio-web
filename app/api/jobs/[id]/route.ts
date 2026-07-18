import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { avancerJob, ETAPES_LABELS } from "@/lib/jobs";

export const maxDuration = 300; // la structuration IA peut durer plusieurs minutes

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = supabaseAdmin();
  const { data: job } = await sb
    .from("jobs")
    .select("etape, statut, titre, message_erreur, rapport, etude_slug, ingest_rapport")
    .eq("id", id)
    .maybeSingle();
  if (!job) return NextResponse.json({ erreur: "Job introuvable." }, { status: 404 });
  return NextResponse.json({ ...job, label: ETAPES_LABELS[job.etape] ?? job.etape });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await avancerJob(id);
  return NextResponse.json(res);
}
