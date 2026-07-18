// Téléchargement du document Word de l'étude.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sb = supabaseAdmin();
  const { data } = await sb.from("etudes").select("docx_base64, titre").eq("slug", slug).maybeSingle();
  if (!data) return new NextResponse("Étude introuvable.", { status: 404 });
  const buffer = Buffer.from(data.docx_base64, "base64");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`Étude fidèle - ${data.titre}.docx`)}`,
    },
  });
}
