import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Un package-lock.json existe aussi au niveau du dossier utilisateur (au-dessus de ce
  // dépôt) : sans cette ligne, Turbopack le confond avec la racine du projet et l'affiche
  // en avertissement à chaque build/dev.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
