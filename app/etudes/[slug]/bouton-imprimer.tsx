"use client";

export function BoutonImprimer({ slug }: { slug: string }) {
  function imprimer() {
    // Ouvre la version plein écran et lance l'impression (→ « Enregistrer en PDF »).
    const w = window.open(`/etudes/${slug}/lecture`, "_blank");
    if (w) w.addEventListener("load", () => setTimeout(() => w.print(), 300));
  }
  return (
    <button type="button" className="bouton secondaire" onClick={imprimer}>
      Imprimer / PDF
    </button>
  );
}
