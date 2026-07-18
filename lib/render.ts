// Rendu HTML d'une étude — port TypeScript de scripts/render_html.py.
// Le template (templates/etude.html du repo pipeline) est embarqué au build.

import { readFileSync } from "fs";
import { join } from "path";
import type { Content } from "./types";

const THEMES: Record<string, Record<string, string>> = {
  vigne: {
    L_GROUND: "#FAF8F2", L_SURFACE: "#FFFFFF", L_INK: "#26231C", L_INK_SOFT: "#5C574B",
    L_ACCENT: "#3D6349", L_ACCENT_SOFT: "#E8EFE9", L_RULE: "#DDD8CC", L_ROW_ALT: "#F3F1E9",
    D_GROUND: "#1D1B16", D_SURFACE: "#26231D", D_INK: "#EAE6DB", D_INK_SOFT: "#A8A292",
    D_ACCENT: "#8CB89A", D_ACCENT_SOFT: "#2A352D", D_RULE: "#403C32", D_ROW_ALT: "#23211B",
    D_TH_INK: "#16211A",
  },
  royal: {
    L_GROUND: "#F8F8FB", L_SURFACE: "#FFFFFF", L_INK: "#232430", L_INK_SOFT: "#585A6B",
    L_ACCENT: "#32427A", L_ACCENT_SOFT: "#E9EBF4", L_RULE: "#D8DAE4", L_ROW_ALT: "#F0F1F6",
    D_GROUND: "#191B22", D_SURFACE: "#222430", D_INK: "#E5E6EE", D_INK_SOFT: "#9EA1B3",
    D_ACCENT: "#9DACE0", D_ACCENT_SOFT: "#2A2F42", D_RULE: "#3A3D4C", D_ROW_ALT: "#1F212B",
    D_TH_INK: "#171A26",
  },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  let out = esc(text);
  out = out.replace(/\[\[([^\]]+)\]\]/g, '<span class="vref">$1</span>');
  out = out.replace(
    /\[\?([^\]]+)\]/g,
    '<span class="incertain" title="Transcription incertaine ou passage possiblement incomplet">$1</span>'
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

let templateCache: string | null = null;
function template(): string {
  if (!templateCache) {
    templateCache = readFileSync(join(process.cwd(), "lib", "etude-template.html"), "utf8");
  }
  return templateCache;
}

export function renderHtml(content: Content): string {
  const meta = content.meta;
  const tokens = THEMES[meta.theme] ?? THEMES.vigne;

  const tocItems: string[] = [];
  const out: string[] = [];
  let sectionOpen = false;
  let listDepth = 0;
  let secNo = 0;

  const closeList = (to = 0) => {
    while (listDepth > to) {
      out.push("</ul>");
      listDepth--;
    }
  };
  const ensureList = (level: number) => {
    closeList(level);
    while (listDepth < level) {
      out.push(listDepth === 0 ? '<ul class="liste">' : "<ul>");
      listDepth++;
    }
  };

  for (const block of content.blocks) {
    const kind = block[0];
    if (kind !== "bullet" && kind !== "bullet2") closeList();
    if (kind === "h2") {
      if (sectionOpen) out.push("</section>");
      secNo++;
      const sid = `s${secNo}`;
      const m = /^(\d+)\.\s+(.*)$/.exec(block[1] as string);
      const [no, title] = m ? [m[1], m[2]] : [String(secNo), block[1] as string];
      tocItems.push(`<li><a href="#${sid}">${inline(title)}</a></li>`);
      out.push(`<section id="${sid}">`);
      out.push(`<h2 class="section-title"><span class="no">${no}</span>${inline(title)}</h2>`);
      sectionOpen = true;
    } else if (kind === "p") {
      out.push(`<p>${inline(block[1] as string)}</p>`);
    } else if (kind === "bullet") {
      ensureList(1);
      out.push(`<li>${inline(block[1] as string)}</li>`);
    } else if (kind === "bullet2") {
      ensureList(2);
      out.push(`<li>${inline(block[1] as string)}</li>`);
    } else if (kind === "box") {
      const tag = block[3] === "ol" ? "ol" : "ul";
      const lis = (block[2] as string[]).map((it) => `<li>${inline(it)}</li>`).join("");
      out.push(`<div class="encadre"><h3>${inline(block[1] as string)}</h3><${tag}>${lis}</${tag}></div>`);
    } else if (kind === "quote") {
      out.push(
        `<div class="prayer"><p class="label">${inline(block[1] as string)}</p><p>${inline(block[2] as string)}</p></div>`
      );
    } else if (kind === "reserve") {
      out.push(
        `<div class="reserve"><p class="label">Réserve de fidélité</p><p>${inline(block[1] as string)}</p></div>`
      );
    } else if (kind === "verseTable") {
      const rows = block[1] as [string, string, string][];
      const note = (block[2] as string) ?? "";
      const trs = rows
        .map(
          (r) =>
            `<tr><td class="ref">${inline(r[0])}</td><td class="point">${inline(r[1])}</td><td class="pdv">${inline(r[2])}</td></tr>`
        )
        .join("");
      out.push(
        '<div class="table-wrap"><table class="versets">' +
          "<caption>Versets cités dans la prédication, avec le texte Parole de Vie</caption>" +
          '<thead><tr><th scope="col">Référence</th><th scope="col">Point appuyé dans le message</th><th scope="col">Texte Parole de Vie</th></tr></thead>' +
          `<tbody>${trs}</tbody></table></div>`
      );
      if (note) out.push(`<p class="footnote">${inline(note)}</p>`);
    }
  }
  closeList();
  if (sectionOpen) out.push("</section>");

  const raw = JSON.stringify(content.blocks);
  if (/\[\?[^\]]+\]/.test(raw) || content.blocks.some((b) => b[0] === "reserve")) {
    out.push(
      '<p class="footnote legende-incertain">Les passages <span class="incertain">soulignés en pointillé</span> et les encadrés « Réserve de fidélité » signalent une transcription incertaine ou un contenu possiblement incomplet — par distinction avec le reste du document, vérifié contre l\'enregistrement transcrit.</p>'
    );
  }

  const metaItems = meta.meta_items
    .map(([k, v]) => `<div><dt>${inline(k)}</dt><dd>${inline(v)}</dd></div>`)
    .join("");

  let page = template();
  const repl: Record<string, string> = {
    ...tokens,
    TITLE: esc(meta.titre),
    EYEBROW: inline(meta.eyebrow),
    META_ITEMS: metaItems,
    TOC_ITEMS: tocItems.join("\n      "),
    SECTIONS: out.join("\n"),
    FOOTER: inline(meta.footer),
  };
  for (const [k, v] of Object.entries(repl)) {
    page = page.split(`{{${k}}}`).join(v);
  }
  const leftover = page.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) throw new Error(`Jetons non remplacés : ${[...new Set(leftover)].join(", ")}`);
  return page;
}

export function wrapLocalHtml(inner: string, titre: string): string {
  return `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titre)}</title></head><body>${inner}</body></html>`;
}
