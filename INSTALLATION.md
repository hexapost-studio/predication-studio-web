# Installer Prédication Studio chez soi

Il n'y a pas de version en ligne partagée que tout le monde utilise pour générer ses
études : chacun installe sa propre instance. Dans tous les cas l'outil vous appartient —
vos clés, votre base de données, vos études — et personne d'autre n'y a accès.

Trois façons d'installer, ce ne sont pas des étapes à suivre dans l'ordre mais trois
choix équivalents selon votre situation :

- **Vous voulez juste vous en servir vous-même, sur votre ordinateur ?** → Option 2.
- **Vous voulez un lien web à partager avec votre église ou votre équipe ?** → Option 1.
- **Vous êtes à l'aise en ligne de commande ?** → Option 3.

---

## Ce qu'il faut avant de commencer (5 minutes, gratuit)

| Compte | À quoi ça sert | Coût |
|---|---|---|
| [supabase.com](https://supabase.com) | La base de données qui garde vos études | Gratuit |
| [openrouter.ai](https://openrouter.ai) | L'accès au modèle IA | Gratuit ou payant, **à votre choix** |
| [vercel.com](https://vercel.com) | L'hébergement du site (option 1 uniquement) | Gratuit |

Aucune carte bancaire n'est nécessaire si vous choisissez un modèle gratuit.

---

## Option 1 — En un clic (votre propre site en ligne)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhexapost-studio%2Fpredication-studio-web&env=OPENROUTER_API_KEY,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,LLM_MODEL&envDescription=Cle%20du%20modele%20IA%20et%20acces%20Supabase&envLink=https%3A%2F%2Fgithub.com%2Fhexapost-studio%2Fpredication-studio-web%2Fblob%2Fmain%2F.env.example&project-name=predication-studio&repository-name=predication-studio)

Le bouton copie le projet sur votre compte GitHub, vous demande les quatre valeurs
ci-dessous, puis met le site en ligne. Comptez 10 minutes.

Les quatre valeurs demandées :

1. `OPENROUTER_API_KEY` — openrouter.ai → *Keys* → *Create key*
2. `SUPABASE_URL` — Supabase → *Settings* → *API* → *Project URL*
3. `SUPABASE_SERVICE_ROLE_KEY` — même page, clé `service_role` (**secrète**)
4. `LLM_MODEL` — voir « Gratuit ou payant ? » plus bas

Puis préparez la base (une seule fois) : voir « Préparer la base » ci-dessous.

---

## Option 2 — Sur votre propre ordinateur

Pour un usage strictement personnel, sans rien mettre en ligne.

```bash
git clone https://github.com/hexapost-studio/predication-studio-web
cd predication-studio-web
npm install
cp .env.example .env.local     # puis remplir avec vos clés
npm run dev
```

Ouvrez http://localhost:3000. L'outil ne tourne que lorsque votre ordinateur est allumé.

---

## Option 3 — Ligne de commande Vercel

```bash
vercel link
vercel env add OPENROUTER_API_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel deploy --prod
```

---

## Préparer la base (obligatoire, une seule fois)

1. Créez un projet sur Supabase (**région Europe** de préférence).
2. *SQL Editor* → collez le contenu de `supabase/schema.sql` → *Run*.
3. Choisissez votre code d'accès (le schéma installe `CHANGE-MOI`) :

   ```sql
   update access_codes set code = 'MON-CODE', label = 'équipe', quota_jour = 5
   where code = 'CHANGE-MOI';
   ```

4. Chargez les 82 versets Parole de Vie déjà vérifiés :

   ```bash
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/seed-cache.mjs
   ```

### Qui peut générer une étude ?

L'outil est **public en lecture** (tout le monde voit la bibliothèque d'études) et
**protégé en écriture** : il faut un code d'accès pour lancer une génération. C'est
ce qui empêche un inconnu de consommer vos crédits IA.

- Ouvrir à un groupe : donnez-lui le code, avec un quota quotidien.
- Plusieurs groupes, quotas séparés :

  ```sql
  insert into access_codes (code, label, quota_jour) values ('JEUNESSE-2026', 'jeunesse', 3);
  ```

- Ouvrir à tous : créez un code public (`insert … values ('LIBRE', 'public', 50)`) et
  affichez-le sur la page. Surveillez alors votre consommation.

---

## Gratuit ou payant ?

L'application fonctionne **à l'identique** dans les deux cas : les contrôles de
fidélité sont les mêmes, et **aucun document non conforme n'est jamais publié**,
quel que soit le modèle. La différence est le taux de reprise.

### Gratuit — 0 €, sans carte bancaire

```
LLM_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

Autres modèles gratuits au catalogue OpenRouter (contexte ≥ 128k, nécessaire ici) :
`openai/gpt-oss-20b:free` · `google/gemma-4-26b-a4b-it:free` ·
`nvidia/nemotron-3-nano-30b-a3b:free` · `nvidia/nemotron-nano-9b-v2:free`

Le catalogue des modèles `:free` évolue régulièrement (des modèles sont retirés ou
renommés) : si l'un de ces identifiants ne fonctionne plus, la liste à jour est sur
[openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0) — filtrer
sur un contexte ≥ 128k.

Limites du palier gratuit : **20 requêtes par minute, 50 par jour**. Une prédication
consomme 1 à 2 requêtes — soit une bonne vingtaine d'études par jour. Largement
suffisant pour une église. En achetant 10 $ de crédits **une seule fois**, la limite
passe à 1 000 requêtes/jour et les modèles `:free` restent facturés 0 €.

À prévoir : un modèle gratuit échoue plus souvent aux contrôles de fidélité. Le job
s'arrête alors en affichant le rapport, et il suffit de le relancer.

### Payant — meilleure fidélité, moins de reprises

```
LLM_MODEL=anthropic/claude-sonnet-5
```

Autres : `anthropic/claude-opus-4.8` · `moonshotai/kimi-k3` · `openai/gpt-5.6-terra` ·
`qwen/qwen3.7-max` · `mistralai/mistral-medium-3.5`

Coût observé : **0,50 à 2 € par prédication** (~35 000 tokens d'entrée, ~15 000 de sortie).

### Changer d'avis plus tard

Modifiez `LLM_MODEL` dans Vercel (*Settings* → *Environment Variables*) puis redéployez.
Rien d'autre à toucher — les études déjà publiées ne bougent pas.

---

## En cas de problème

| Symptôme | Cause la plus fréquente |
|---|---|
| « Aucune clé de modèle configurée » | `OPENROUTER_API_KEY` absente ou non redéployée |
| « Code d'accès inconnu » | `schema.sql` non exécuté, ou code non personnalisé |
| Quota du palier gratuit atteint | 50 requêtes/jour dépassées — attendre, ou créditer 10 $ |
| Le job s'arrête sur un rapport de contrôle | Normal avec un modèle faible — relancer le job |
| Page de connexion Vercel au lieu du site | *Settings* → *Deployment Protection* → désactiver Vercel Authentication |
