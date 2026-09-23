import { useEffect } from "react";
import { fmtLong } from "../lib/format";
import { toKey } from "shared";

/**
 * Printen: elke pagina rendert een <PrintHeader> (alleen zichtbaar op papier)
 * en een <PrintButton>. De header zet ook de papierrichting, zodat Ctrl/Cmd+P
 * hetzelfde resultaat geeft als de knop.
 */

function setPageOrientation(landscape: boolean) {
  let el = document.getElementById("page-orientation") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "page-orientation";
    document.head.appendChild(el);
  }
  el.textContent = `@page{size:A4 ${landscape ? "landscape" : "portrait"}; margin:12mm;}`;
}

export function PrintHeader({
  title, sub, landscape = false,
}: { title: string; sub?: string; landscape?: boolean }) {
  useEffect(() => { setPageOrientation(landscape); }, [landscape]);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return (
    <div className="printhead">
      <h1>{title}</h1>
      <div className="meta">
        Team S planning{sub ? ` · ${sub}` : ""} · afgedrukt op {fmtLong(toKey(now))} om {time}
      </div>
    </div>
  );
}

export function PrintButton({ label = "Printen" }: { label?: string }) {
  function print() {
    try { window.print(); }
    catch { alert("Printen lukt niet vanuit dit venster."); }
  }
  return (
    <button className="btn printbtn" onClick={print}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" />
      </svg>
      {label}
    </button>
  );
}
