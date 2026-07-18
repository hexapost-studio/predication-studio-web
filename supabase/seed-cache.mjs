// Injecte les versets Parole de Vie vérifiés dans la table pdv_cache.
// Usage : SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/seed-cache.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));
const cache = JSON.parse(readFileSync(join(dir, "pdv-cache.json"), "utf8"));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const rows = Object.entries(cache).map(([ref_norm, v]) => ({
  ref_norm,
  reference: v.reference_affichee,
  texte: v.texte,
  source: v.source,
}));
const { error } = await sb.from("pdv_cache").upsert(rows);
if (error) throw error;
console.log(`${rows.length} versets injectés dans pdv_cache.`);
