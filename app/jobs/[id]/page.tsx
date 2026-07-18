"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";

const ETAPES = [
  ["ingestion", "Récupération de la prédication"],
  ["structuration", "Structuration fidèle du message"],
  ["versets", "Vérification de chaque verset (Parole de Vie)"],
  ["controles", "Contrôle de fidélité"],
  ["rendu", "Mise en page des documents"],
] as const;
const ORDRE = ETAPES.map(([k]) => k as string);

interface EtatJob {
  etape: string;
  statut: string;
  titre: string | null;
  message_erreur: string | null;
  etude_slug: string | null;
  rapport: { sections: { nom: string; problemes: string[]; infos: string[] }[] } | null;
}

export default function SuiviJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [etat, setEtat] = useState<EtatJob | null>(null);
  const [reseau, setReseau] = useState<string | null>(null);
  const enCours = useRef(false);

  useEffect(() => {
    let arrete = false;

    async function boucle() {
      while (!arrete) {
        try {
          const res = await fetch(`/api/jobs/${id}`);
          const job: EtatJob = await res.json();
          if (arrete) return;
          setEtat(job);
          setReseau(null);
          if (job.statut !== "en_cours") return;
          if (!enCours.current) {
            enCours.current = true;
            // Exécute l'étape courante (l'appel dure le temps de l'étape).
            await fetch(`/api/jobs/${id}`, { method: "POST" });
            enCours.current = false;
          }
        } catch {
          setReseau("Connexion interrompue — nouvelle tentative…");
          await new Promise((r) => setTimeout(r, 4000));
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    boucle();
    return () => {
      arrete = true;
    };
  }, [id]);

  const idx = etat ? ORDRE.indexOf(etat.etape) : -1;
  const termine = etat?.statut === "termine";
  const erreur = etat?.statut === "erreur";

  return (
    <main>
      <h1>{etat?.titre ?? "Préparation de votre étude…"}</h1>
      <p className="lead">
        {termine
          ? "Votre étude est prête et publiée dans la bibliothèque."
          : erreur
            ? "La génération s'est arrêtée — le détail est ci-dessous."
            : "Chaque étape est réelle : ce que vous voyez avancer, c'est le travail effectivement fait."}
      </p>

      <ol className="etapes">
        {ETAPES.map(([cle, label], i) => {
          const faite = termine || (idx > i && !erreur) || (erreur && idx > i);
          const active = !termine && !erreur && idx === i;
          return (
            <li key={cle} className={faite ? "faite" : active ? "active" : ""}>
              <span className="puce" aria-hidden>
                {faite ? "✓" : i + 1}
              </span>
              {label}
              {active && "…"}
            </li>
          );
        })}
      </ol>

      {reseau && <p className="note">{reseau}</p>}

      {erreur && (
        <div className="card">
          <p className="erreur" role="alert">
            {etat?.message_erreur ?? "Erreur inconnue."}
          </p>
          {etat?.rapport && (
            <div className="certificat">
              {etat.rapport.sections
                .filter((s) => s.problemes.length)
                .map((s) => (
                  <details key={s.nom} open>
                    <summary>
                      <span className="ko">✗</span> {s.nom}
                    </summary>
                    <ul>
                      {s.problemes.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </details>
                ))}
            </div>
          )}
          <p className="note">
            Vous pouvez <Link href="/">réessayer depuis l&apos;accueil</Link> — souvent une seconde
            tentative suffit, la structuration n&apos;étant jamais identique.
          </p>
        </div>
      )}

      {termine && etat?.etude_slug && (
        <p>
          <Link className="bouton" href={`/etudes/${etat.etude_slug}`}>
            Ouvrir l&apos;étude →
          </Link>
        </p>
      )}
    </main>
  );
}
