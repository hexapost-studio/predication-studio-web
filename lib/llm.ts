// Couche modèle unifiée : Anthropic direct, OpenRouter (Claude, Kimi, GPT, Qwen,
// Mistral, et les modèles GRATUITS `:free`) ou OpenAI direct. Le fournisseur est
// choisi par LLM_PROVIDER, ou déduit de LLM_MODEL, ou du premier des trois jeux
// de clés présents.
//
// Variables d'environnement :
//   LLM_PROVIDER   = anthropic | openrouter | openai     (optionnel)
//   LLM_MODEL      = id du modèle                        (optionnel, défauts ci-dessous)
//   LLM_MAX_TOKENS = plafond de sortie                   (optionnel)
//   ANTHROPIC_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY
//
// Modèles PAYANTS (OpenRouter) :
//   anthropic/claude-sonnet-5 · anthropic/claude-opus-4.8 · moonshotai/kimi-k3
//   openai/gpt-5.6-terra · qwen/qwen3.7-max · mistralai/mistral-medium-3.5
//
// Modèles GRATUITS (OpenRouter, suffixe `:free`, 0 €) :
//   nvidia/nemotron-3-super:free · openai/gpt-oss-20b:free · google/gemma-4-26b-a4b:free
//   Contraintes du palier gratuit : 20 requêtes/minute et 50 requêtes/jour
//   (1 000/jour après 10 $ de crédits achetés une seule fois). Une prédication
//   consomme 1 à 2 requêtes — le palier gratuit suffit largement à un usage normal.

import Anthropic from "@anthropic-ai/sdk";

type Provider = "anthropic" | "openrouter" | "openai";

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  openrouter: "anthropic/claude-sonnet-5",
  openai: "gpt-5.6-terra",
};

/** Anthropic EXIGE max_tokens ; OpenRouter/OpenAI non (le fournisseur applique
 *  alors son propre maximum, ce qui évite un 400 sur les modèles gratuits dont
 *  le plafond de sortie est plus bas que 32 000). */
const MAX_TOKENS_ANTHROPIC = 32000;

function resolveProvider(): Provider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" || explicit === "openrouter" || explicit === "openai") {
    return explicit;
  }
  const model = process.env.LLM_MODEL ?? "";
  if (model.includes("/")) return "openrouter";
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gpt")) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error(
    "Aucune clé de modèle configurée (ANTHROPIC_API_KEY, OPENROUTER_API_KEY ou OPENAI_API_KEY)."
  );
}

export function describeLlm(): { provider: Provider; model: string; gratuit: boolean } {
  const provider = resolveProvider();
  const model = process.env.LLM_MODEL || DEFAULT_MODEL[provider];
  return { provider, model, gratuit: model.endsWith(":free") };
}

/** Plafond de sortie explicite, ou undefined pour laisser le fournisseur décider. */
function maxTokensPour(provider: Provider): number | undefined {
  const brut = process.env.LLM_MAX_TOKENS;
  if (brut) {
    const n = Number.parseInt(brut, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Anthropic impose le champ ; les deux autres s'en passent très bien.
  return provider === "anthropic" ? MAX_TOKENS_ANTHROPIC : undefined;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Une complétion texte simple : system + user → texte.
 *  Réessaie automatiquement sur 429/5xx (palier gratuit OpenRouter : 20 req/min). */
export async function completer(system: string, user: string, maxTokens?: number): Promise<string> {
  const { provider, model, gratuit } = describeLlm();
  const plafond = maxTokens ?? maxTokensPour(provider);

  if (provider === "anthropic") {
    const client = new Anthropic();
    const message = await client.messages.create({
      model,
      max_tokens: plafond ?? MAX_TOKENS_ANTHROPIC,
      system,
      messages: [{ role: "user", content: user }],
    });
    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  // OpenRouter et OpenAI parlent la même API chat/completions.
  const base =
    provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
  const key =
    provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) throw new Error(`Clé manquante pour le fournisseur ${provider}.`);

  const corps: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (plafond !== undefined) corps.max_tokens = plafond;

  // Palier gratuit = 20 requêtes/minute : on laisse le temps de repasser sous la limite.
  const essaisMax = gratuit ? 4 : 2;
  let derniereErreur = "";

  for (let essai = 1; essai <= essaisMax; essai++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        ...(provider === "openrouter"
          ? { "x-title": "Predication Studio", "http-referer": "https://predication-studio.local" }
          : {}),
      },
      body: JSON.stringify(corps),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        error?: { message?: string };
      };
      if (data.error?.message) throw new Error(`${provider} : ${data.error.message}`);
      const choix = data.choices?.[0];
      const text = choix?.message?.content;
      if (!text) throw new Error(`${provider} : réponse vide du modèle ${model}.`);
      if (choix?.finish_reason === "length") {
        throw new Error(
          `Le modèle ${model} a atteint son plafond de sortie avant la fin du JSON. ` +
            `Choisissez un modèle avec une sortie plus longue (LLM_MODEL) ou relancez le job.`
        );
      }
      return text;
    }

    const detail = await res.text().catch(() => "");
    derniereErreur = `${res.status} : ${detail.slice(0, 300)}`;

    // 429 (quota/minute) et 5xx (fournisseur indisponible) → nouvel essai.
    if ((res.status === 429 || res.status >= 500) && essai < essaisMax) {
      const attente = res.status === 429 ? 20000 * essai : 2000 * essai;
      await dormir(attente);
      continue;
    }

    if (res.status === 429) {
      throw new Error(
        gratuit
          ? `Quota du palier gratuit atteint (20 requêtes/minute, 50/jour sans crédits). ` +
            `Réessayez dans quelques minutes, ou ajoutez 10 $ de crédits OpenRouter une seule ` +
            `fois pour passer à 1 000 requêtes/jour — les modèles \`:free\` restent à 0 €.`
          : `${provider} a répondu 429 (quota atteint) : ${detail.slice(0, 200)}`
      );
    }
    throw new Error(`${provider} a répondu ${derniereErreur}`);
  }

  throw new Error(`${provider} a répondu ${derniereErreur}`);
}
