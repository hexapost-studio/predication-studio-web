import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prédication Studio — études fidèles de prédications",
  description:
    "Transformez une prédication (YouTube ou transcript) en étude fidèle : lecture en ligne, Word, PDF — chaque verset vérifié en Parole de Vie, chaque citation contrôlée contre l'enregistrement.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="chrome">
          <header className="site">
            <Link href="/" className="brand">
              Prédication <span className="amp">Studio</span>
            </Link>
            <p className="tagline">Des études fidèles, vérifiées verset par verset.</p>
          </header>
          {children}
          <footer className="site">
            Hexapost Studio · Les textes bibliques cités proviennent de la traduction Parole de Vie
            (© Alliance biblique française) — seuls les versets cités dans les études sont
            conservés, avec leur source.
          </footer>
        </div>
      </body>
    </html>
  );
}
