// Génération Word — port de scripts/build_docx.js (mêmes réglages A4/typo).

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, Footer, TabStopType, TabStopPosition,
  UnderlineType,
} from "docx";
import type { Content } from "./types";

const PAGE = { width: 11906, height: 16838 };
const MARGIN = 1134;
const CONTENT_W = PAGE.width - 2 * MARGIN;

const THEMES: Record<string, { accent: string; accentSoft: string; rowAlt: string; rule: string }> = {
  vigne: { accent: "3D6349", accentSoft: "E8EFE9", rowAlt: "F3F1E9", rule: "C9D6DC" },
  royal: { accent: "32427A", accentSoft: "E9EBF4", rowAlt: "F0F1F6", rule: "C9CFDE" },
};
const GOLD = "B98A2E", GOLD_INK = "7A5A17", QUOTE_BG = "F6F1E7", GRAY = "666666";

export async function buildDocx(content: Content): Promise<Buffer> {
  const T = THEMES[content.meta.theme] ?? THEMES.vigne;
  let numSeq = 0;

  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: T.rule } as const;
  const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const cellMargins = { top: 120, bottom: 120, left: 160, right: 160 };

  function inlineRuns(text: string, extra: Record<string, unknown> = {}): TextRun[] {
    const runs: TextRun[] = [];
    const parts = text.split(/(\[\[[^\]]+\]\]|\[\?[^\]]+\]|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("[[") && part.endsWith("]]")) {
        runs.push(new TextRun({ text: part.slice(2, -2), bold: true, color: T.accent, ...extra }));
      } else if (part.startsWith("[?") && part.endsWith("]")) {
        runs.push(new TextRun({
          text: part.slice(2, -1), color: GOLD_INK,
          underline: { type: UnderlineType.DOTTED, color: GOLD }, ...extra,
        }));
      } else if (part.startsWith("**") && part.endsWith("**")) {
        runs.push(new TextRun({ text: part.slice(2, -2), bold: true, ...extra }));
      } else if (part.startsWith("*") && part.endsWith("*")) {
        runs.push(new TextRun({ text: part.slice(1, -1), italics: true, ...extra }));
      } else {
        runs.push(new TextRun({ text: part, ...extra }));
      }
    }
    return runs;
  }

  const children: (Paragraph | Table)[] = [];
  const meta = content.meta;
  const NATURE =
    "Retranscription fidèle et structurée de la prédication, établie à partir de l'enregistrement transcrit. " +
    "Aucune analyse ni interprétation n'a été ajoutée : seuls le contenu, les versets, les illustrations et les prières " +
    "prononcés par le prédicateur sont restitués, réorganisés pour la lecture et débarrassés des scories propres à la " +
    "transcription orale automatique (répétitions de mots, hésitations, phrases inachevées).";

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 240 }, children: inlineRuns(meta.titre) }));
  for (const [label, value] of meta.meta_items) {
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: label + "  ", bold: true, color: T.accent, size: 21 }),
        new TextRun({ text: value, size: 21 }),
      ],
    }));
  }
  children.push(new Paragraph({
    spacing: { before: 240, after: 360 },
    shading: { fill: T.accentSoft, type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: T.accent, space: 8 } },
    indent: { left: 240, right: 240 },
    children: inlineRuns(NATURE, { size: 21, color: "333333" }),
  }));

  for (const block of content.blocks) {
    const kind = block[0];
    if (kind === "h2") {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 420, after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: T.rule, space: 4 } },
        children: inlineRuns(block[1] as string),
      }));
    } else if (kind === "p") {
      children.push(new Paragraph({ spacing: { after: 200, line: 300 }, alignment: AlignmentType.LEFT, children: inlineRuns(block[1] as string) }));
    } else if (kind === "bullet") {
      children.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 100, line: 300 }, children: inlineRuns(block[1] as string) }));
    } else if (kind === "bullet2") {
      children.push(new Paragraph({ numbering: { reference: "bullets", level: 1 }, spacing: { after: 80, line: 300 }, children: inlineRuns(block[1] as string) }));
    } else if (kind === "box") {
      numSeq++;
      children.push(new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: block[1] as string, bold: true, color: T.accent, size: 21, allCaps: true })],
      }));
      for (const item of block[2] as string[]) {
        children.push(new Paragraph({
          numbering: { reference: block[3] === "ol" ? "numbers" + numSeq : "bullets", level: 0 },
          spacing: { after: 100, line: 300 },
          children: inlineRuns(item),
        }));
      }
    } else if (kind === "quote") {
      const border = { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 8 } };
      children.push(new Paragraph({
        spacing: { before: 160, after: 60 }, shading: { fill: QUOTE_BG, type: ShadingType.CLEAR },
        border, indent: { left: 240, right: 240 },
        children: [new TextRun({ text: block[1] as string, bold: true, color: GOLD_INK, size: 21 })],
      }));
      children.push(new Paragraph({
        spacing: { after: 240, line: 300 }, shading: { fill: QUOTE_BG, type: ShadingType.CLEAR },
        border, indent: { left: 240, right: 240 },
        children: inlineRuns(block[2] as string, { italics: true }),
      }));
    } else if (kind === "reserve") {
      const border = { left: { style: BorderStyle.DASHED, size: 12, color: GOLD, space: 8 } };
      children.push(new Paragraph({
        spacing: { before: 160, after: 60 }, border, indent: { left: 240, right: 240 },
        children: [new TextRun({ text: "RÉSERVE DE FIDÉLITÉ", bold: true, color: GOLD_INK, size: 19 })],
      }));
      children.push(new Paragraph({
        spacing: { after: 200, line: 300 }, border, indent: { left: 240, right: 240 },
        children: inlineRuns(block[1] as string, { size: 20, color: "555555" }),
      }));
    } else if (kind === "verseTable") {
      const rows = block[1] as [string, string, string][];
      const note = (block[2] as string) ?? "";
      const colRef = 1750, colPoint = 2600, colPdv = CONTENT_W - colRef - colPoint;
      const headerCell = (text: string, width: number) => new TableCell({
        borders: cellBorders, width: { size: width, type: WidthType.DXA },
        shading: { fill: T.accent, type: ShadingType.CLEAR },
        margins: cellMargins, verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 21 })] })],
      });
      const bodyCell = (text: string, width: number, opts: { bold?: boolean; shade?: boolean } = {}) => new TableCell({
        borders: cellBorders, width: { size: width, type: WidthType.DXA },
        margins: cellMargins, verticalAlign: VerticalAlign.TOP,
        shading: opts.shade ? { fill: "F4F8FA", type: ShadingType.CLEAR } : undefined,
        children: [new Paragraph({ spacing: { line: 276 }, children: inlineRuns(text, { size: opts.bold ? 21 : 20, bold: !!opts.bold }) })],
      });
      children.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [colRef, colPoint, colPdv],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [headerCell("Référence", colRef), headerCell("Point appuyé dans le message", colPoint), headerCell("Texte Parole de Vie", colPdv)],
          }),
          ...rows.map((r, i) => new TableRow({
            children: [
              bodyCell(r[0], colRef, { bold: true, shade: i % 2 === 1 }),
              bodyCell(r[1], colPoint, { shade: i % 2 === 1 }),
              bodyCell(r[2], colPdv, { shade: i % 2 === 1 }),
            ],
          })),
        ],
      }));
      if (note) {
        children.push(new Paragraph({ spacing: { before: 160, after: 200 }, children: inlineRuns(note, { size: 19, color: GRAY, italics: true }) }));
      }
    } else if (kind === "pageBreak") {
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    }
  }

  const raw = JSON.stringify(content.blocks);
  if (/\[\?[^\]]+\]/.test(raw) || content.blocks.some((b) => b[0] === "reserve")) {
    children.push(new Paragraph({
      spacing: { before: 200 },
      children: inlineRuns(
        "*Les passages soulignés en pointillé et les encadrés « Réserve de fidélité » signalent une transcription incertaine ou un contenu possiblement incomplet — par distinction avec le reste du document, vérifié contre l'enregistrement transcrit.*",
        { size: 19, color: GRAY }
      ),
    }));
  }

  const numbering = {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 620, hanging: 320 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1100, hanging: 320 } } } },
        ],
      },
      ...Array.from({ length: numSeq }, (_, i) => ({
        reference: "numbers" + (i + 1),
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 620, hanging: 360 } } } }],
      })),
    ],
  };

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 40, bold: true, font: "Arial", color: T.accent },
          paragraph: { spacing: { before: 0, after: 240 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: T.accent },
          paragraph: { spacing: { before: 420, after: 200 }, outlineLevel: 1 } },
      ],
    },
    numbering,
    sections: [{
      properties: { page: { size: PAGE, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: meta.footer, size: 18, color: GRAY }),
              new TextRun({ text: "\t", size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: GRAY }),
            ],
          })],
        }),
      },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}
