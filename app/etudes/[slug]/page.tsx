import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { BoutonImprimer } from "./bouton-imprimer";
import type { QaReport } from "@/lib/types";

export const revalidate = 300;

export default async function PageEtude({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = supabaseAdmin();
  const { data: etude } = await sb
    .from("etudes")
    .select("slug, titre, orateur, occasion, favicon, rapport, nb_versets, nb_incertitudes, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!etude) notFound();

  const rapport = etude.rapport as QaReport | null;

  return (
    <main>
      <h1>
        <span aria-hidden>{etude.favicon} </span>
        {etude.titre}
      </h1>
      <p className="lead">{[etude.orateur, etude.occasion].filter(Boolean).join(" · ")}</p>

      <div className="barre-outils">
        <a className="bouton" href={`/etudes/${etude.slug}/word`}>
          Télécharger en Word
        </a>
        <BoutonImprimer slug={etude.slug} />
        <a className="bouton secondaire" href={`/etudes/${etude.slug}/lecture`} target="_blank" rel="noopener">
          Plein écran ↗
        </a>
      </div>

      <iframe
        className="cadre-etude"
        src={`/etudes/${etude.slug}/lecture`}
        title={`Étude fidèle — ${etude.titre}`}
        id="cadre-etude"
      />

      <h2 className="section-titre">Certificat de fidélité</h2>
      <div className="card certificat">
        <p className="note">
          Cette étude n&apos;a été publiée qu&apos;après validation automatique de tous les
          contrôles : {etude.nb_versets} versets vérifiés dans la traduction Parole de Vie, citations
          contrôlées mot à mot contre l&apos;enregistrement transcrit, couverture complète de la
          prédication{etude.nb_incertitudes > 0
            ? `, ${etude.nb_incertitudes} passage(s) explicitement signalé(s) comme incertain(s)`
            : ", aucun passage incertain"}.
        </p>
        {rapport?.sections?.map((s) => (
          <div className="ligne" key={s.nom}>
            <span className={s.problemes.length ? "ko" : "ok"}>{s.problemes.length ? "✗" : "✓"}</span>
            <span>
              {s.nom}
              {s.infos.length > 0 && (
                <details>
                  <summary>détails</summary>
                  <ul>
                    {s.infos.map((inf, i) => (
                      <li key={i}>{inf}</li>
                    ))}
                  </ul>
                </details>
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="note">
        <Link href="/">← Retour à la bibliothèque</Link>
      </p>
    </main>
  );
}
