/**
 * In de iPhone/iPad-app vanaf het beginscherm doet window.print() niets (iOS
 * negeert het daar stil). Daar maken we de printversie als PDF en openen we
 * het deelmenu, waarin "Print" staat.
 */

export function printUnsupported(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  const apple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
  return apple && window.matchMedia("(display-mode: standalone)").matches;
}

const A4 = { w: 210, h: 297 };
const MARGIN = 12; // mm, gelijk aan @page in Print.tsx
const PX_PER_MM = 96 / 25.4;
// Elementen die we liever niet doormidden knippen bij een paginaovergang.
const KEEP_TOGETHER = "tr, .block, .mcell, .card, .shiftrow, .activityrow, .printhead";

/** De regels uit alle @media print-blokken, zodat de PDF er net zo uitziet als op papier. */
function printCss(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule && /\bprint\b/.test(rule.media.mediaText)) {
        for (const inner of Array.from(rule.cssRules)) out.push(inner.cssText);
      }
    }
  }
  return out.join("\n");
}

export async function makePdf(landscape: boolean): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const target = document.querySelector("main") as HTMLElement;
  const pageW = (landscape ? A4.h : A4.w) - 2 * MARGIN;
  const pageH = (landscape ? A4.w : A4.h) - 2 * MARGIN;
  const widthPx = Math.round(pageW * PX_PER_MM);
  const scale = 2;

  let blocks: { top: number; bottom: number }[] = [];
  const canvas = await html2canvas(target, {
    scale,
    backgroundColor: "#ffffff",
    windowWidth: widthPx,
    width: widthPx,
    onclone: (doc, el) => {
      const style = doc.createElement("style");
      style.textContent = printCss();
      doc.head.appendChild(style);
      const origin = el.getBoundingClientRect().top;
      blocks = Array.from(el.querySelectorAll(KEEP_TOGETHER)).map((b) => {
        const r = b.getBoundingClientRect();
        return { top: (r.top - origin) * scale, bottom: (r.bottom - origin) * scale };
      }).filter((b) => b.bottom > b.top);
    },
  });

  const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const mmPerPx = pageW / canvas.width;
  const sliceMax = Math.floor(pageH / mmPerPx);
  // Net iets te lang (bv. een maand met zes weken): liever verkleind op één pagina.
  if (canvas.height > sliceMax && canvas.height <= sliceMax * 1.35) {
    const w = pageW * (sliceMax / canvas.height);
    pdf.addImage(canvas, "JPEG", MARGIN + (pageW - w) / 2, MARGIN, w, pageH, undefined, "FAST");
    return toFile(pdf.output("blob"), target);
  }
  let y = 0;
  let first = true;
  while (y < canvas.height - 1) {
    let end = Math.min(canvas.height, y + sliceMax);
    if (end < canvas.height) {
      // Knip boven het eerste blok dat over de rand zou lopen, als dat niet te veel ruimte kost.
      const split = blocks.filter((b) => b.top < end && b.bottom > end && b.top > y + sliceMax * 0.4);
      if (split.length) end = Math.min(...split.map((b) => b.top));
    }
    const h = Math.ceil(end - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, h);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (!first) pdf.addPage();
    pdf.addImage(slice, "JPEG", MARGIN, MARGIN, pageW, h * mmPerPx, undefined, "FAST");
    first = false;
    y = end;
  }
  return toFile(pdf.output("blob"), target);
}

function toFile(blob: Blob, target: HTMLElement): File {
  const title = target.querySelector(".printhead h1")?.textContent ?? "Team S planning";
  const name = title.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return new File([blob], `${name}.pdf`, { type: "application/pdf" });
}

/** Opent het deelmenu met de PDF. Gooit NotAllowedError als de tik "verlopen" is. */
export async function sharePdf(file: File): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, "") });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // gebruiker sloot het menu
      throw e;
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
