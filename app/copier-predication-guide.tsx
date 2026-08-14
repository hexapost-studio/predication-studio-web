"use client";

// Bookmarklet "Copier la prédication" — source lisible et commentée dans
// public/copier-predication.bookmarklet.js (garder les deux synchronisés à la
// main : ce lien est la version minifiée en une ligne de ce fichier). Lit le
// panneau officiel "Afficher la transcription" que YouTube affiche pour ses
// propres utilisateurs (aucun appel réseau du script, donc aucun rapport avec
// la récupération automatique côté serveur ni ses limites).
const LIEN_BOOKMARKLET =
  "javascript:(function%20()%20%7B%20function%20trouverBoutonTranscription()%20%7B%20return%20(%20document.querySelector('button%5Baria-label*%3D%22ranscri%22%20i%5D')%20%7C%7C%20Array.from(document.querySelectorAll(%22yt-button-shape%20button%2C%20button%22)).find((b)%20%3D%3E%20%2Ftranscription%7Ctranscript%2Fi.test(b.getAttribute(%22aria-label%22)%20%7C%7C%20b.textContent%20%7C%7C%20%22%22)%20)%20)%3B%20%7D%20function%20texteDuPanneau()%20%7B%20const%20segments%20%3D%20document.querySelectorAll(%22ytd-transcript-segment-renderer%22)%3B%20if%20(!segments.length)%20return%20%22%22%3B%20return%20Array.from(segments)%20.map((seg)%20%3D%3E%20%7B%20const%20texte%20%3D%20seg.querySelector(%22.segment-text%2C%20yt-formatted-string.segment-text%22)%3B%20return%20(texte%20%3F%20texte.textContent%20%3A%20seg.textContent%20%7C%7C%20%22%22).trim()%3B%20%7D)%20.filter(Boolean)%20.join(%22%20%22)%3B%20%7D%20function%20attendrePanneau(essaisRestants)%20%7B%20const%20texte%20%3D%20texteDuPanneau()%3B%20if%20(texte)%20%7B%20copierEtAvertir(texte)%3B%20return%3B%20%7D%20if%20(essaisRestants%20%3C%3D%200)%20%7B%20alert(%20%22Le%20panneau%20de%20transcription%20ne%20s'est%20pas%20rempli%20%C3%A0%20temps.%20Ouvrez-le%20manuellement%20%22%20%2B%20%22(bouton%20%C2%AB%20%E2%80%A6%20%C2%BB%20sous%20la%20vid%C3%A9o%20%E2%86%92%20Afficher%20la%20transcription)%2C%20puis%20relancez%20ce%20favori.%22%20)%3B%20return%3B%20%7D%20setTimeout(()%20%3D%3E%20attendrePanneau(essaisRestants%20-%201)%2C%20400)%3B%20%7D%20function%20copierEtAvertir(texte)%20%7B%20const%20nbMots%20%3D%20texte.split(%2F%5Cs%2B%2F).filter(Boolean).length%3B%20navigator.clipboard%20.writeText(texte)%20.then(()%20%3D%3E%20alert(%22Copi%C3%A9%20(%22%20%2B%20nbMots%20%2B%20%22%20mots).%20Revenez%20sur%20Pr%C3%A9dication%20Studio%20et%20collez%20(Cmd%2FCtrl%2BV).%22))%20.catch(()%20%3D%3E%20%7B%20window.prompt(%22Copie%20automatique%20impossible%20%E2%80%94%20s%C3%A9lectionnez%20tout%20ce%20texte%20(Cmd%2FCtrl%2BA%20puis%20Cmd%2FCtrl%2BC)%20%3A%22%2C%20texte)%3B%20%7D)%3B%20%7D%20const%20dejaOuvert%20%3D%20document.querySelector(%22ytd-transcript-segment-renderer%22)%3B%20if%20(dejaOuvert)%20%7B%20attendrePanneau(0)%3B%20return%3B%20%7D%20const%20bouton%20%3D%20trouverBoutonTranscription()%3B%20if%20(!bouton)%20%7B%20alert(%20%22Bouton%20%C2%AB%20Afficher%20la%20transcription%20%C2%BB%20introuvable%20sur%20cette%20page.%20Assurez-vous%20d'%C3%AAtre%20sur%20%22%20%2B%20%22la%20page%20de%20la%20vid%C3%A9o%20YouTube%20(pas%20une%20liste%20de%20lecture)%2C%20sous%20la%20vid%C3%A9o%2C%20d%C3%A9pliez%20%C2%AB%20%E2%80%A6%20%C2%BB%20puis%20%22%20%2B%20%22cliquez%20vous-m%C3%AAme%20sur%20%C2%AB%20Afficher%20la%20transcription%20%C2%BB%2C%20puis%20relancez%20ce%20favori.%22%20)%3B%20return%3B%20%7D%20bouton.click()%3B%20attendrePanneau(12)%3B%20%7D)()%3B";

export function CopierPredicationGuide() {
  return (
    <details className="guide-bookmarklet">
      <summary>Le lien YouTube n&apos;a pas fonctionné ? Récupérez le texte en un clic</summary>
      <ol>
        <li>
          Faites glisser ce lien dans votre barre de favoris :{" "}
          <a href={LIEN_BOOKMARKLET} onClick={(e) => e.preventDefault()}>
            📋 Copier la prédication
          </a>{" "}
          <span className="note-inline">
            (sur Chrome/Edge, le glisser-déposer direct est bloqué : faites un clic droit sur la
            barre de favoris → « Ajouter une page… » → collez ce lien dans le champ URL)
          </span>
        </li>
        <li>Ouvrez la vidéo YouTube de la prédication, dans un onglet.</li>
        <li>Cliquez sur le favori « 📋 Copier la prédication ».</li>
        <li>
          Revenez ici et collez (<kbd>Cmd/Ctrl+V</kbd>) dans le champ texte ci-dessus, ou utilisez
          le bouton « Coller depuis le presse-papier ».
        </li>
      </ol>
      <p className="note">
        Ce raccourci lit le panneau « Afficher la transcription » que YouTube affiche lui-même à
        ses utilisateurs — rien à voir avec la récupération automatique côté serveur, donc jamais
        affecté par ses limites.
      </p>
    </details>
  );
}
