"use client"; // Les error boundaries doivent être des Client Components

import { useEffect } from "react";
import Link from "next/link";

export default function Erreur({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main>
      <h1>Une erreur inattendue est survenue</h1>
      <p className="lead">
        Quelque chose s&apos;est mal passé pendant l&apos;affichage de cette page. Ce n&apos;est
        probablement pas définitif — souvent une configuration manquante (base de données,
        clé de modèle) ou un problème réseau passager.
      </p>
      <p className="note">
        <button className="bouton" type="button" onClick={() => unstable_retry()}>
          Réessayer
        </button>{" "}
        · <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </main>
  );
}
