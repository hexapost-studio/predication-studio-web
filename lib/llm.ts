// Couche modèle unifiée : Anthropic direct, OpenRouter (Claude, Kimi, GPT, Qwen,
// Mistral…) ou OpenAI direct. Le fournisseur est choisi par LLM_PROVIDER, ou déduit
// de LLM_MODEL, ou du premier des trois jeux de clés présents.
//
// Variables d'environnement :
//   LLM_PROVIDER = anthropic | openrouter | openai     (optionnel)
//   LLM_MODEL    = id du modèle                        (optionnel, défauts ci-dessous)
//   ANTHROPIC_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY
//
// Exemples de modèles OpenRouter (IDs vérifiés au catalogue) :
//   anthropic/claude-sonnet-5 · anthropic/claude-opus-4.8 · moonshotai/kimi-k3
//   openai/gpt-5.6-terra · qwen/qwen3.7-max · mistralai/mistral-medium-3.5

import Anthropic from "@anthropic-ai/sdk";

type Provider = "anthropic" | "openrouter" | "openai";

const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  openrouter: "anthropic/claude-sonnet-5",
  openai: "gpt-5.6-terra",
};

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

export function describeLlm(): { provider: Provider; model: string } {
  const provider = resolveProvider();
  return { provider, model: process.env.LLM_MODEL || DEFAULT_MODEL[provider] };
}

/** Une complétion texte simple : system + user → texte. */
export async function completer(system: string, user: string, maxTokens = 32000): Promise<string> {
  const { provider, model } = describeLlm();

  if (provider === "anthropic") {
    const client = new Anthropic();
    const message = await client.messages.create({
      model,
      max_tokens: maxTokens,
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

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(provider === "openrouter"
        ? { "x-title": "Predication Studio", "http-referer": "https://predication-studio.local" }
        : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${provider} a répondu ${res.status} : ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(`${provider} : ${data.error.message}`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${provider} : réponse vide du modèle ${model}.`);
  return text;
}
