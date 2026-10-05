"use client";

import { t } from "@/lib/i18n/strings";
import { useLibrary } from "@/store/useLibrary";
import { LangToggle } from "./Hud";

export function GateScreen() {
  const phase = useLibrary((s) => s.phase);
  const lang = useLibrary((s) => s.lang);
  const enter = useLibrary((s) => s.enter);
  const hidden = phase !== "gate";
  return (
    <div className={`gate ${hidden ? "gate--hidden" : ""}`} aria-hidden={hidden}>
      <div className="gate__inner">
        <div className="gate__crest" aria-hidden>
          <svg viewBox="0 0 64 64" width="56" height="56">
            <path d="M8 50 L32 12 L56 50 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M18 50 V30 M26 50 V24 M32 50 V20 M38 50 V24 M46 50 V30" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="32" cy="12" r="3" fill="currentColor" />
          </svg>
        </div>
        <h1 className="gate__title">Arcanum</h1>
        <div className="gate__sub">The Infinite AI Library · अनंत AI पुस्तकालय</div>
        <p className="gate__tag">{t("tagline", lang)}</p>
        <div className="gate__actions">
          <button className="btn btn--gold btn--lg" onClick={enter} disabled={hidden}>
            {t("enter", lang)}
          </button>
          <LangToggle />
        </div>
        <p className="gate__hint">{t("enterHint", lang)}</p>
      </div>
    </div>
  );
}
