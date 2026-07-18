# Déploiement — Prédication Studio (web)

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

## 2. Clé API Anthropic

Sur [console.anthropic.com](https://console.anthropic.com) : créer une clé et vérifier que le
compte a des **crédits actifs** (~0,50–2 € par prédication générée, modèle claude-sonnet-5).
Ranger la clé dans `~/.secrets` comme d'habitude.

## 3. Vercel

```bash
cd ~/projets/icc/predication-studio-web
vercel link          # créer/lier le projet
vercel env add ANTHROPIC_API_KEY production
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
