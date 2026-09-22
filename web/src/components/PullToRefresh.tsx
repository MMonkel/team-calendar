import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70; // px die je moet trekken voordat loslaten ververst
const MAX_PULL = 110;
const MIN_SPIN_MS = 600; // spinner kort laten zien zodat je ziet dát er ververst is

/**
 * Omlaag vegen bovenaan de pagina ververst de gegevens van het huidige tabblad,
 * zonder de hele pagina te herladen (weergave, datum en filters blijven staan).
 * Werkt ook in de iPhone-app vanaf het beginscherm, waar Safari zelf geen
 * pull-to-refresh heeft.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => void }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (busy.current || e.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      if (document.querySelector(".overlay")) return; // niet tijdens een open venster
      startY.current = e.touches[0].clientY;
    }
    function onMove(e: TouchEvent) {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) { pullRef.current = 0; setPull(0); }
        return;
      }
      // Eigen gebaar: voorkom Safari's bounce/herlaad zodat de staat bewaard blijft.
      if (e.cancelable) e.preventDefault();
      const d = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = d;
      setPull(d);
    }
    function onEnd() {
      if (startY.current === null) return;
      startY.current = null;
      const reached = pullRef.current >= THRESHOLD;
      pullRef.current = 0;
      setPull(0);
      if (!reached) return;
      busy.current = true;
      setRefreshing(true);
      onRefresh();
      window.setTimeout(() => { busy.current = false; setRefreshing(false); }, MIN_SPIN_MS);
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  const height = refreshing ? 48 : pull;
  if (height === 0) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div className="ptr" style={{ height }} aria-live="polite">
      <span
        className={refreshing ? "ptr-icon spin" : "ptr-icon"}
        style={refreshing ? undefined : { transform: `rotate(${(pull / THRESHOLD) * 270}deg)`, opacity: Math.min(1, pull / THRESHOLD) }}
        aria-hidden
      >↻</span>
      <span className="ptr-label">
        {refreshing ? "Verversen…" : ready ? "Loslaten om te verversen" : "Trek omlaag om te verversen"}
      </span>
    </div>
  );
}
