"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopierPredicationGuide } from "./copier-predication-guide";

export function GenerateurForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [texte, setTexte] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function collerDuPressePapier() {
    try {
      const contenu = await navigator.clipboard.readText();
      if (contenu.trim()) setTexte(contenu);
    } catch {
      // Permission navigateur refusée/non disponible : l'utilisateur peut
      // toujours coller à la main (Cmd/Ctrl+V) dans le champ, rien de cassé.
    }
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, texte, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.erreur ?? "Une erreur est survenue.");
        setEnvoi(false);
        return;
      }
      router.push(`/jobs/${data.id}`);
    } catch {
      setErreur("Connexion impossible — réessayez.");
      setEnvoi(false);
    }
  }

  return (
    <form className="generer" onSubmit={soumettre}>
      <div className="champ">
        <label htmlFor="url">
          Lien YouTube de la prédication{" "}
          <span className="note-inline">(optionnel — l&apos;essai automatique échoue parfois selon les protections de YouTube ; le champ texte ci-dessous fonctionne toujours)</span>
        </label>
        <input
          id="url"
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={envoi}
        />
      </div>
      <div className="ou">ou</div>
      <div className="champ">
        <div className="champ-entete">
          <label htmlFor="texte">Transcript en texte (export NotebookLM, sous-titres copiés…)</label>
          <button type="button" className="bouton-discret" onClick={collerDuPressePapier} disabled={envoi}>
            Coller depuis le presse-papier
          </button>
        </div>
        <textarea
          id="texte"
          placeholder="Collez ici le texte complet de la prédication…"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          disabled={envoi}
        />
        <CopierPredicationGuide />
      </div>
      <div className="champ">
        <label htmlFor="code">Code d&apos;accès</label>
        <input
          id="code"
          type="text"
          autoComplete="off"
          placeholder="Le code transmis par votre équipe"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={envoi}
          required
        />
      </div>
      {erreur && (
        <p className="erreur" role="alert">
          {erreur}
        </p>
      )}
      <button className="bouton" type="submit" disabled={envoi}>
        {envoi ? "Préparation…" : "Générer l'étude fidèle"}
      </button>
      <p className="note">
        Comptez 3 à 6 minutes. Gardez la page ouverte : vous suivrez chaque étape, et le résultat
        n&apos;est publié que si tous les contrôles de fidélité sont au vert.
      </p>
    </form>
  );
}
