import { noticeWarning, type DateKey } from "shared";

export function NoticeWarning({ from }: { from: DateKey | "" }) {
  if (!from) return null;
  const w = noticeWarning(from);
  if (!w) return null;
  if ("pastDate" in w) {
    return (
      <div className="warn">
        <b>Datum in het verleden</b>
        Je vraagt een dag aan die al geweest is. Kan, maar controleer het even.
      </div>
    );
  }
  return (
    <div className="warn">
      <b>Binnen 3 maanden</b>
      Er zitten nog {w.daysUntil} dagen tussen vandaag en de eerste dag van je aanvraag. Alexandra en Marc zien dit gemarkeerd.
    </div>
  );
}
