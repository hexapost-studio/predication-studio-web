// Sert la page HTML complète de l'étude (lecture plein écran + impression PDF).
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("etudes").select("html").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return new NextResponse("Étude introuvable.", { status: 404 });
    return new NextResponse(data.html, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  } catch {
    return new NextResponse(
      "Impossible de contacter la base de données. Vérifiez la configuration Supabase ou réessayez dans un instant.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
}
