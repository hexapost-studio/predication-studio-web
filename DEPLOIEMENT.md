# Déploiement — Prédication Studio (web)

Notes techniques de référence pour déployer et exploiter votre propre instance (quotas,
codes d'accès, limites de la fonction serverless). Si c'est votre première installation,
commencez plutôt par **[INSTALLATION.md](INSTALLATION.md)**, plus progressif et pensé
pour un public non technique — revenez ici ensuite pour aller plus loin.

Trois prérequis, ~15 minutes.

## 1. Supabase (base de données)

1. Créer un projet sur [supabase.com](https://supabase.com) (région EU).
2. SQL Editor → coller et exécuter `supabase/schema.sql`.
3. **Personnaliser le code d'accès** (le schéma insère `CHANGE-MOI`) :
   ```sql
   update access_codes set code = 'VOTRE-CODE', label = 'équipe', quota_jour = 5
   where code = 'CHANGE-MOI';
   ```
4. Injecter les 82 versets Parole de Vie déjà vérifiés :
   ```bash
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/seed-cache.mjs
   ```
   (URL et service_role key : Settings → API du projet Supabase.)

## 2. Clé du modèle IA (au choix)

L'app accepte trois fournisseurs — fournir AU MOINS une clé (rangée dans `~/.secrets`) :

| Fournisseur | Variable | Modèles |
|---|---|---|
| **OpenRouter** (recommandé : une clé, tous les modèles) | `OPENROUTER_API_KEY` | `anthropic/claude-sonnet-5` (défaut), `anthropic/claude-opus-4.8`, `moonshotai/kimi-k3`, `openai/gpt-5.6-terra`, `qwen/qwen3.7-max`, `mistralai/mistral-medium-3.5`… |
| Anthropic direct | `ANTHROPIC_API_KEY` | `claude-sonnet-5` (défaut) |
| OpenAI direct | `OPENAI_API_KEY` | `gpt-5.6-terra` (défaut) |

Choix explicite : `LLM_PROVIDER` et/ou `LLM_MODEL`. Compter ~0,50–2 € par prédication
selon le modèle. **Vérifier que le compte a des crédits suffisants** : une prédication
consomme ~35 000 tokens d'entrée + ~15 000 de sortie.

⚠ Les contrôles de fidélité sont identiques quel que soit le modèle : un modèle plus
faible échouera plus souvent aux contrôles (jobs en erreur plus fréquents), mais ne
publiera jamais un document non conforme.

## 3. Vercel

```bash
cd ~/projets/icc/predication-studio-web
vercel link          # créer/lier le projet
vercel env add OPENROUTER_API_KEY production   # ou ANTHROPIC_API_KEY / OPENAI_API_KEY
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel deploy --prod
```

Note plan Hobby : l'étape de structuration IA tourne dans une fonction dont la durée est
déclarée à 300 s (`maxDuration` dans `app/api/jobs/[id]/route.ts`). Si un job très long
dépasse, la page de suivi relance l'étape automatiquement — l'état vit en base, rien
n'est perdu. Les documents (HTML + Word) sont stockés en base ; pas de bucket à créer.

## Test local

```bash
cp .env.example .env.local   # puis remplir
npm run dev                  # http://localhost:3000
```

Vérification de cohérence du pipeline (sans base ni clé API) :
```bash
npx tsx scripts/sanity.ts <content.json résolu> <transcript.txt> <segments.json>
# attendu : 5 contrôles ✓ + SANITY OK (fixtures dans le repo predication-studio, corpus/)
```

## Gestion des codes d'accès

Tout se fait en SQL (pas d'interface d'admin en v1) :
```sql
insert into access_codes (code, label, quota_jour) values ('CODE-EQUIPE-2', 'jeunesse', 3);
update access_codes set quota_jour = 10 where code = 'VOTRE-CODE';
delete from access_codes where code = 'ANCIEN-CODE';
```
