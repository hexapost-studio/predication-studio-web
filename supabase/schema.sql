-- Schéma Prédication Studio (web) — à exécuter dans l'éditeur SQL Supabase.

create table if not exists access_codes (
  code text primary key,
  label text not null default '',
  quota_jour int not null default 3,
  used_count int not null default 0,
  used_date date not null default current_date
);

create table if not exists pdv_cache (
  ref_norm text primary key,
  reference text not null,
  texte text not null,
  source text not null default ''
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null references access_codes(code),
  source_url text,
  source_texte text,
  titre text,
  etape text not null default 'ingestion',
  statut text not null default 'en_cours', -- en_cours | termine | erreur
  message_erreur text,
  transcript text,
  transcript_segmente text,
  segments jsonb,
  ingest_rapport jsonb,
  contenu jsonb,
  rapport jsonb,
  double_passe_faite boolean not null default false,
  etude_slug text
);

create table if not exists etudes (
  slug text primary key,
  created_at timestamptz not null default now(),
  titre text not null,
  orateur text not null default '',
  occasion text not null default '',
  theme text not null default 'vigne',
  favicon text not null default '📖',
  html text not null,
  docx_base64 text not null,
  rapport jsonb,
  nb_versets int not null default 0,
  nb_incertitudes int not null default 0,
  job_id uuid references jobs(id)
);

-- Tout passe par la clé service (backend) : RLS activée, aucune policy publique.
alter table access_codes enable row level security;
alter table pdv_cache enable row level security;
alter table jobs enable row level security;
alter table etudes enable row level security;

-- Premier code d'accès (à personnaliser) :
insert into access_codes (code, label, quota_jour)
values ('CHANGE-MOI', 'code initial', 3)
on conflict (code) do nothing;
