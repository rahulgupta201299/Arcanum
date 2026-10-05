"use client";

import { gendered, t } from "@/lib/i18n/strings";
import { sectionFor } from "@/lib/sections";
import { bookPalette } from "@/lib/world/textures";
import { useLibrary } from "@/store/useLibrary";

/** Suggested books as cards. Nothing moves until the reader picks one. */
export function RecsTray() {
  const recs = useLibrary((s) => s.recs);
  const best = useLibrary((s) => s.recsBestsellers);
  const phase = useLibrary((s) => s.phase);
  const lang = useLibrary((s) => s.lang);
  const inspecting = useLibrary((s) => s.inspecting);
  const fetchHit = useLibrary((s) => s.fetchHit);
  const set = useLibrary((s) => s.set);
  const gender = useLibrary((s) => s.librarian.gender);
  if (!recs.length || inspecting || phase === "walking" || phase === "fetching" || phase === "gate") return null;
  const busy = phase === "thinking";
  return (
    <aside className="recs" aria-label={t("recsTitle", lang)}>
      <div className="recs__head">
        <div>
          <div className="bookcard__eyebrow">{best ? t("bestsellers", lang) : t("recsTitle", lang)}</div>
          <div className="recs__hint muted">{gendered(t("recsHint", lang), lang, gender)}</div>
        </div>
        <button className="inspector__close recs__close" onClick={() => set("recs", [])} aria-label={t("close", lang)}>
          ×
        </button>
      </div>
      <div className="recs__list">
        {recs.map((r) => {
          const pal = bookPalette(r.book.id);
          return (
            <article key={r.book.id} className="rec">
              <div className="rec__spine" style={{ background: `linear-gradient(160deg, ${pal.css}, hsl(${pal.h},${pal.s}%,${Math.max(8, pal.l - 10)}%))`, color: pal.accent }}>
                <span>{r.book.title}</span>
              </div>
              <div className="rec__body">
                <div className="rec__title">{r.book.title}</div>
                <div className="rec__author">{r.book.authors.join(", ")}</div>
                <div className="rec__meta">
                  {r.book.bestseller && <span className="tag tag--gold">★ {t("bestseller", lang)}</span>}
                  {r.book.rating && <span>★ {r.book.rating.toFixed(1)}</span>}
                  {r.book.pages && (
                    <span>
                      {r.book.pages} {t("pages", lang)}
                    </span>
                  )}
                  <span>§ {r.location.section} · {sectionFor(r.location.section).name[lang]}</span>
                </div>
                <p className="rec__desc">{r.book.description}</p>
                <button className="btn btn--gold btn--sm" onClick={() => fetchHit(r)} disabled={busy}>
                  {t("bringIt", lang)}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
