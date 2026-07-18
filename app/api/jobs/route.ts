import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { youtubeId } from "@/lib/ingest";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const code = (body?.code ?? "").trim();
  const url = (body?.url ?? "").trim();
  const texte = (body?.texte ?? "").trim();

  if (!code) return NextResponse.json({ erreur: "Entrez votre code d'accès." }, { status: 400 });
  if (!url && !texte) {
    return NextResponse.json({ erreur: "Collez un lien YouTube ou le texte du transcript." }, { status: 400 });
  }
  if (url && !youtubeId(url)) {
    return NextResponse.json({ erreur: "Ce lien YouTube n'est pas reconnu." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: accessCode } = await sb.from("access_codes").select("*").eq("code", code).maybeSingle();
  if (!accessCode) return NextResponse.json({ erreur: "Code d'accès inconnu." }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);
  const used = accessCode.used_date === today ? accessCode.used_count : 0;
  if (used >= accessCode.quota_jour) {
    return NextResponse.json(
      { erreur: `Quota atteint pour aujourd'hui (${accessCode.quota_jour} génération(s) par jour).` },
      { status: 429 }
    );
  }
  await sb.from("access_codes").update({ used_count: used + 1, used_date: today }).eq("code", code);

  const { data: job, error } = await sb
    .from("jobs")
    .insert({ code, source_url: url || null, source_texte: texte || null })
    .select("id")
    .single();
  if (error || !job) return NextResponse.json({ erreur: "Création du job impossible." }, { status: 500 });
  return NextResponse.json({ id: job.id });
}
