// Étape IA : transcript segmenté → content.json sous contrat strict.
// Le modèle ne touche NI aux versets (résolus depuis le cache) NI au rendu.

import { completer } from "./llm";
import type { Content } from "./types";

const CONTRAT = `Tu produis la structuration fidèle d'une prédication chrétienne francophone à partir de son transcript (sous-titres automatiques, avec marqueurs [§N] tous les 200 mots).

RÈGLES ABSOLUES (issues de references/regles-fidelite.md du projet predication-studio) :
1. AUCUNE analyse, interprétation ou commentaire ajouté. Si l'orateur ne l'a pas dit, ça n'existe pas.
2. AUCUN texte biblique écrit de mémoire : la colonne PDV du tableau reste "" (vide).
3. Vocabulaire proscrit (jamais, sous aucune forme) : doctrine/doctrinal, pathologie/pathologique, KPI, "So What", "Connective Tissue", "Analyse de contexte", rétro-ingénierie.
4. Aucune omission silencieuse : passage douteux → marquer plutôt qu'omettre ou deviner.
5. Ordre chronologique réel du déroulé (un lien YouTube peut être un CULTE COMPLET : accueil, témoignages, sainte cène, offrandes, louange, message, appel — tout structurer, le message occupant plusieurs sections).
6. Registre et expressions propres de l'orateur conservés ; scories ASR nettoyées (répétitions, hésitations, noms propres corrigés prudemment : Mical pas "Milka", Carmel pas "caramel", sainte cène pas "scène scène", Nabuchodonosor, Jaebets, Obed-Édom).

SYNTAXE DU CONTENU :
- Sections : ["h2", "N. Titre", {"segments": [début, fin]}] — segments = plage [§N] couverte, la couverture TOTALE du transcript est exigée (chevauchements permis, trous interdits).
- ["p", "…"], ["bullet", "…"], ["bullet2", "…"] (sous-puce).
- ["box", "Titre", ["item", …], "ol"|"ul"] : listes énumérées PAR l'orateur.
- ["quote", "Label", "texte"] : prières et proclamations conduites.
- ["reserve", "…"] : passage possiblement incomplet / transcription trop dégradée.
- Inline : **gras**, *italique* (chants en italique, jamais entre guillemets), [[Référence biblique]] pour TOUTE référence mentionnée, [?mot] pour transcription incertaine.
- Guillemets français « … » UNIQUEMENT pour des citations STRICTEMENT verbatim du transcript (y compris petites fautes ASR bénignes) — chaque citation de ≥ 5 mots est vérifiée mécaniquement mot à mot contre le transcript et bloque la publication si elle ne s'y trouve pas. Citation courte et exacte, ou pas de guillemets du tout.
- Fusionner des passages distants dans une même paire de guillemets est INTERDIT (utiliser plusieurs citations).

TABLEAU DES VERSETS (avant-dernier bloc, précédé de ["pageBreak"] et d'un ["h2","N. Tableau récapitulatif des versets cités"] SANS segments, suivi d'un ["p"] d'introduction) :
- ["verseTable", [[ref, point, ""], …], "(*) Référence complétée : citée ou évoquée sans chapitre et verset exacts à l'oral."]
- UNE ligne par référence citée ou évoquée dans tout le culte, dans l'ordre d'apparition. Suffixe " (*)" si l'orateur n'a pas donné chapitre:verset à l'oral.
- Toute [[réf]] du corps doit avoir sa ligne ; toute ligne doit être citée [[…]] dans le corps ; toute référence énoncée dans le transcript (« livre chapitre N », « livre N verset M ») doit avoir sa ligne.
- Lapsus de référence corrigé en direct par l'orateur → meta.recall_exceptions: [{"base":"Livre N","raison":"…"}].

MÉTA :
{"titre","eyebrow" (ex. "Culte … · Étude fidèle de la prédication"),"meta_items":[["Orateur","…"],["Occasion","…"]],"footer" (mention : Document établi d'après la transcription · Traduction biblique citée : Parole de Vie (Alliance biblique française)),"theme":"vigne"(croissance/fruit)|"royal"(vérité/identité/royauté),"favicon":"un émoji","recall_exceptions":[…] si besoin}

Réponds UNIQUEMENT avec le JSON (aucun texte autour).`;

export async function structurer(
  transcriptSegmente: string,
  titreConnu: string | null
): Promise<Content> {
  const text = await completer(
    CONTRAT,
    (titreConnu ? `Titre YouTube de la vidéo : ${titreConnu}

` : "") +
      `Transcript segmenté :

${transcriptSegmente}`
  );
  const jsonStr = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
  let content: Content;
  try {
    content = JSON.parse(jsonStr) as Content;
  } catch {
    throw new Error("La structuration n'a pas produit un JSON valide — relancez le job.");
  }
  if (!content.meta?.titre || !Array.isArray(content.blocks)) {
    throw new Error("Structure invalide (meta/blocks manquants) — relancez le job.");
  }
  return content;
}

export async function doublePasse(
  content: Content,
  problemes: string[],
  transcriptSegmente: string
): Promise<Content> {
  const text = await completer(
    CONTRAT,
    `Voici un content.json qui a ÉCHOUÉ aux contrôles de fidélité. Corrige-le (contenu fidèle, mêmes règles) et renvoie le JSON complet corrigé.

` +
      `ERREURS BLOQUANTES À CORRIGER :
${problemes.map((p) => `- ${p}`).join("\n")}

` +
      `CONTENT.JSON ACTUEL :
${JSON.stringify(content)}

` +
      `TRANSCRIPT SEGMENTÉ (source de vérité) :
${transcriptSegmente}`
  );
  const jsonStr = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "");
  return JSON.parse(jsonStr) as Content;
}
