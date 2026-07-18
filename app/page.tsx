import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { GenerateurForm } from "./generateur-form";

export const revalidate = 60;

interface EtudeCard {
  slug: string;
  titre: string;
  orateur: string;
  favicon: string;
  nb_versets: number;
  nb_incertitudes: number;
}

export default async function Accueil() {
  let etudes: EtudeCard[] = [];
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("etudes")
      .select("slug, titre, orateur, favicon, nb_versets, nb_incertitudes")
      .order("created_at", { ascending: false })
      .limit(30);
    etudes = (data as EtudeCard[]) ?? [];
  } catch {
    // base non configurée : la page reste utilisable pour présenter l'outil
  }

  return (
    <main>
      <h1>Une prédication entre, une étude fidèle sort.</h1>
      <p className="lead">
        Collez le lien YouTube d&apos;une prédication (ou son transcript) : vous recevez une étude
        soignée — lisible en ligne, téléchargeable en Word ou PDF — où chaque verset est donné dans
        la traduction Parole de Vie et chaque citation est vérifiée mot à mot contre
        l&apos;enregistrement. Rien d&apos;inventé, rien d&apos;omis.
      </p>

      <div className="card">
        <GenerateurForm />
      </div>

      <h2 className="section-titre">Bibliothèque des études</h2>
      {etudes.length === 0 ? (
        <p className="note">Aucune étude publiée pour l&apos;instant — la vôtre peut être la première.</p>
      ) : (
        <div className="biblio">
          {etudes.map((e) => (
            <Link key={e.slug} href={`/etudes/${e.slug}`} className="etude">
              <span className="emoji" aria-hidden>
                {e.favicon}
              </span>
              <h3>{e.titre}</h3>
              <p className="qui">{e.orateur}</p>
              <span className="badge">
                ✓ {e.nb_versets} versets vérifiés
                {e.nb_incertitudes > 0 ? ` · ${e.nb_incertitudes} passage(s) signalé(s)` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
