"use client";

import { t } from "@/lib/i18n/strings";
import { sectionFor } from "@/lib/sections";
import { useLibrary } from "@/store/useLibrary";

const prefill = (s: string) => window.dispatchEvent(new CustomEvent("lv:prefill", { detail: s }));

export function BookCard() {
  const phase = useLibrary((s) => s.phase);
  const held = useLibrary((s) => s.heldBook);
  const target = useLibrary((s) => s.target);
  const results = useLibrary((s) => s.results);
  const lang = useLibrary((s) => s.lang);
  const inspecting = useLibrary((s) => s.inspecting);
  const setInspecting = useLibrary((s) => s.setInspecting);
  const fetchHit = useLibrary((s) => s.fetchHit);
  const send = useLibrary((s) => s.send);
  const recsOpen = useLibrary((s) => s.recs.length > 0);
  if (!held || inspecting || recsOpen || phase === "walking" || phase === "fetching") return null;
  const loc = target?.book.id === held.id ? target.location : null;
  const alts = results.filter((r) => r.book.id !== held.id).slice(0, 4);
  const year = held.year ? (held.year < 0 ? `${-held.year} BCE` : held.year) : null;

  return (
    <aside className="bookcard" aria-label={held.title}>
      <div className="bookcard__eyebrow">
        {loc ? `${t("section", lang)} ${loc.section} · ${sectionFor(loc.section).name[lang]}` : ""}
        {loc && <span className="muted"> · bay {loc.bay + 1}, shelf {loc.shelf + 1}</span>}
      </div>
      <h2 className="bookcard__title">{held.title}</h2>
      <div className="bookcard__author">{held.authors.join(", ")}</div>
      <div className="bookcard__meta">
        {year && <span>{year}</span>}
        {held.pages && (
          <span>
            {held.pages} {t("pages", lang)}
          </span>
        )}
        {held.rating && <span>★ {held.rating.toFixed(1)}</span>}
        {held.source !== "seed" && <span className="tag">via {held.source === "openlibrary" ? "Open Library" : "Google Books"}</span>}
      </div>
      <p className="bookcard__desc">{held.description}</p>
      {target?.why?.length ? (
        <div className="why">
          {target.why.map((w) => (
            <span key={w} className="tag tag--why">
              {w}
            </span>
          ))}
        </div>
      ) : null}
      <div className="bookcard__actions">
        <button className="btn btn--gold" onClick={() => setInspecting(true)}>
          {t("inspect", lang)}
        </button>
        <button className="btn" onClick={() => prefill(lang === "hi" ? "इस किताब के बारे में बताओ" : "Tell me about this book")}>
          {t("ask", lang)}
        </button>
        <button className="btn" onClick={() => send(lang === "hi" ? "ऐसी और किताबें सुझाओ" : "Suggest similar books")} disabled={phase !== "presenting"}>
          {t("more", lang)}
        </button>
      </div>
      {alts.length > 0 && (
        <div className="alts">
          <div className="alts__label">{t("alternatives", lang)}</div>
          {alts.map((a) => (
            <button key={a.book.id} className="alt" onClick={() => fetchHit(a)} disabled={phase !== "presenting" && phase !== "idle"}>
              <span className="alt__title">{a.book.title}</span>
              <span className="alt__sub">
                {a.book.authors[0]} · § {a.location.section}
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
