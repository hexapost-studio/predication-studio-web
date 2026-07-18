// Sert la page HTML complète de l'étude (lecture plein écran + impression PDF).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sb = supabaseAdmin();
  const { data } = await sb.from("etudes").select("html").eq("slug", slug).maybeSingle();
  if (!data) return new NextResponse("Étude introuvable.", { status: 404 });
  return new NextResponse(data.html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
