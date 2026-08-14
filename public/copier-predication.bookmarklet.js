// Bookmarklet "Copier la prédication" — à exécuter depuis la page YouTube de la
// vidéo (pas depuis Prédication Studio). Ouvre le panneau officiel « Afficher la
// transcription » de YouTube, lit le texte déjà rendu par leur propre interface
// (aucun appel réseau fait par ce script : rien à voir avec la récupération
// automatique côté serveur, donc aucun problème de jeton anti-robot possible),
// le copie dans le presse-papier. Revenez ensuite sur Prédication Studio et collez
// (Cmd/Ctrl+V) dans le champ texte.
//
// Ce fichier est la source lisible du lien "javascript:" généré dans
// app/copier-predication-guide.tsx (minifié en une ligne à l'installation du favori
// — voir ce composant pour la version encodée). Garder les deux synchronisés.
(function () {
  function trouverBoutonTranscription() {
    return (
      document.querySelector('button[aria-label*="ranscri" i]') ||
      Array.from(document.querySelectorAll("yt-button-shape button, button")).find((b) =>
        /transcription|transcript/i.test(b.getAttribute("aria-label") || b.textContent || "")
      )
    );
  }

  function texteDuPanneau() {
    const segments = document.querySelectorAll("ytd-transcript-segment-renderer");
    if (!segments.length) return "";
    return Array.from(segments)
      .map((seg) => {
        const texte = seg.querySelector(".segment-text, yt-formatted-string.segment-text");
        return (texte ? texte.textContent : seg.textContent || "").trim();
      })
      .filter(Boolean)
      .join(" ");
  }

  function attendrePanneau(essaisRestants) {
    const texte = texteDuPanneau();
    if (texte) {
      copierEtAvertir(texte);
      return;
    }
    if (essaisRestants <= 0) {
      alert(
        "Le panneau de transcription ne s'est pas rempli à temps. Ouvrez-le manuellement " +
          "(bouton « … » sous la vidéo → Afficher la transcription), puis relancez ce favori."
      );
      return;
    }
    setTimeout(() => attendrePanneau(essaisRestants - 1), 400);
  }

  function copierEtAvertir(texte) {
    const nbMots = texte.split(/\s+/).filter(Boolean).length;
    navigator.clipboard
      .writeText(texte)
      .then(() => alert("Copié (" + nbMots + " mots). Revenez sur Prédication Studio et collez (Cmd/Ctrl+V)."))
      .catch(() => {
        window.prompt("Copie automatique impossible — sélectionnez tout ce texte (Cmd/Ctrl+A puis Cmd/Ctrl+C) :", texte);
      });
  }

  const dejaOuvert = document.querySelector("ytd-transcript-segment-renderer");
  if (dejaOuvert) {
    attendrePanneau(0);
    return;
  }
  const bouton = trouverBoutonTranscription();
  if (!bouton) {
    alert(
      "Bouton « Afficher la transcription » introuvable sur cette page. Assurez-vous d'être sur " +
        "la page de la vidéo YouTube (pas une liste de lecture), sous la vidéo, dépliez « … » puis " +
        "cliquez vous-même sur « Afficher la transcription », puis relancez ce favori."
    );
    return;
  }
  bouton.click();
  attendrePanneau(12);
})();
