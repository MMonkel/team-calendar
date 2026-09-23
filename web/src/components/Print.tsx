import { useEffect, useState } from "react";
import { fmtLong } from "../lib/format";
import { makePdf, printUnsupported, sharePdf } from "../lib/printPdf";
import { toKey } from "shared";
import { Modal } from "./Modal";

/**
 * Printen: elke pagina rendert een <PrintHeader> (alleen zichtbaar op papier)
 * en een <PrintButton>. De header zet ook de papierrichting, zodat Ctrl/Cmd+P
 * hetzelfde resultaat geeft als de knop. In de iPhone-app vanaf het
 * beginscherm werkt window.print() niet; daar maakt de knop een PDF.
 */

let landscapeNow = false;

function setPageOrientation(landscape: boolean) {
  landscapeNow = landscape;
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
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<File | null>(null);

  async function print() {
    if (!printUnsupported()) {
      try { window.print(); }
      catch { alert("Printen lukt niet vanuit dit venster."); }
      return;
    }
    setBusy(true);
    let file: File;
    try { file = await makePdf(landscapeNow); }
    catch { alert("De PDF maken lukte niet."); return; }
    finally { setBusy(false); }
    try { await sharePdf(file); }
    // Duurde het maken te lang, dan staat iOS het deelmenu niet meer toe
    // zonder nieuwe tik: vraag die tik via een venstertje.
    catch { setReady(file); }
  }

  async function shareReady() {
    const file = ready!;
    setReady(null);
    try { await sharePdf(file); }
    catch { alert("Het deelmenu openen lukte niet."); }
  }

  return (
    <>
      <button className="btn printbtn" onClick={print} disabled={busy}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" />
        </svg>
        {busy ? "PDF maken…" : label}
      </button>
      {ready && (
        <Modal
          title="PDF is klaar"
          sub="Kies in het deelmenu voor Print, of bewaar of verstuur de PDF."
          confirmLabel="Deelmenu openen"
          onConfirm={shareReady}
          onClose={() => setReady(null)}
        >{null}</Modal>
      )}
    </>
  );
}
