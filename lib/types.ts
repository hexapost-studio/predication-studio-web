// Schéma partagé du pipeline (miroir de references/schema.md du repo predication-studio)

export type Block =
  | ["h2", string, { segments?: [number, number] }?]
  | ["p", string]
  | ["bullet", string]
  | ["bullet2", string]
  | ["box", string, string[], "ol" | "ul"]
  | ["quote", string, string]
  | ["reserve", string]
  | ["verseTable", VerseRow[], string]
  | ["pageBreak"];

export type VerseRow = [string, string, string]; // [référence, point appuyé, texte PDV]

export interface ContentMeta {
  titre: string;
  eyebrow: string;
  meta_items: [string, string][];
  footer: string;
  theme: "vigne" | "royal";
  favicon: string;
  recall_exceptions?: { base: string; raison: string }[];
}

export interface Content {
  meta: ContentMeta;
  blocks: Block[];
}

export type JobStep =
  | "ingestion"
  | "structuration"
  | "versets"
  | "rendu"
  | "controles"
  | "termine"
  | "erreur";

export interface QaSection {
  nom: string;
  problemes: string[];
  infos: string[];
}

export interface QaReport {
  sections: QaSection[];
  ok: boolean;
}

export interface Segment {
  id: number;
  apercu: string;
}
