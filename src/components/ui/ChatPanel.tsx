"use client";

import { useEffect, useRef, useState } from "react";
import { gendered, t } from "@/lib/i18n/strings";
import { getSTT } from "@/lib/voice";
import { useLibrary } from "@/store/useLibrary";
import { Status } from "./Hud";

export function ChatPanel() {
  const phase = useLibrary((s) => s.phase);
  const messages = useLibrary((s) => s.messages);
  const lang = useLibrary((s) => s.lang);
  const pending = useLibrary((s) => s.pending);
  const listening = useLibrary((s) => s.listening);
  const librarian = useLibrary((s) => s.librarian);
  const chips = useLibrary((s) => s.chips);
  const send = useLibrary((s) => s.send);
  const set = useLibrary((s) => s.set);
  const [text, setText] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [note, setNote] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, chips, pending]);

  useEffect(() => {
    const prefill = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      setCollapsed(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    };
    window.addEventListener("lv:prefill", prefill);
    return () => window.removeEventListener("lv:prefill", prefill);
  }, []);

  if (phase === "gate" || phase === "opening" || phase === "entering") return null;

  const submit = (v = text) => {
    if (!v.trim()) return;
    void send(v);
    setText("");
  };

  const mic = () => {
    const stt = getSTT();
    if (!stt.supported) {
      setNote(t("noVoice", lang));
      setTimeout(() => setNote(""), 4000);
      return;
    }
    if (listening) {
      stt.stop();
      return;
    }
    set("listening", true);
    stt.start(lang, {
      onPartial: (p) => setText(p),
      onFinal: (f) => submit(f),
      onEnd: () => set("listening", false),
      onError: (e: string) => {
        set("listening", false);
        if (e !== "no-speech" && e !== "aborted") setNote(`Mic: ${e}`);
        setTimeout(() => setNote(""), 3000);
      },
    }, { silenceMs: 2200, noSpeechMs: 9000 });
  };

  const firstTurn = messages.filter((m) => m.role === "user").length === 0;
  const chipList = firstTurn ? t("suggestions", lang) : chips;
  const showSuggestions = chipList.length > 0 && !pending;

  return (
    <section className={`chat ${collapsed ? "chat--collapsed" : ""}`} aria-label={`Conversation with ${librarian.name}`}>
      <button className="chat__handle" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand chat" : "Collapse chat"}>
        <span />
      </button>
      <div className="chat__head">
        <div className="avatar" aria-hidden>
          {librarian.name[0]}
        </div>
        <div>
          <div className="chat__name">{librarian.name}</div>
          <div className="chat__role">{lang === "hi" ? (librarian.gender === "female" ? "लाइब्रेरियन · AI" : "लाइब्रेरियन · AI") : "Librarian · AI"}</div>
        </div>
        <Status />
      </div>
      <div className="chat__list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg msg--${m.role}`} lang={m.lang === "hi" ? "hi" : "en"}>
            {m.text}
          </div>
        ))}
        {pending && (
          <div className="msg msg--librarian msg--typing" aria-label="typing">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      {showSuggestions && (
        <div className="chips">
          {chipList.map((s) => (
            <button key={s} className="chip" onClick={() => submit(s)} disabled={pending}>
              {s}
            </button>
          ))}
        </div>
      )}
      {note && <div className="chat__note">{note}</div>}
      {listening && !note && (
        <div className="chat__note chat__note--info">
          {lang === "hi" ? "बात पूरी होने पर 2 सेकंड रुकिए — या माइक दबाकर तुरंत भेजिए" : "Pause for ~2 seconds when you're done — or tap the mic to send now"}
        </div>
      )}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" className={`mic ${listening ? "mic--on" : ""}`} onClick={mic} aria-label={listening ? "Stop listening and send" : "Speak"} title={listening ? (lang === "hi" ? "रोकें और भेजें" : "Stop & send") : lang === "hi" ? "बोलिए (हिंदी)" : "Speak (English)"}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? gendered(t("listening", lang), lang, librarian.gender) : t("placeholder", lang)}
          aria-label="Message"
          enterKeyHint="send"
        />
        <button type="submit" className="send" disabled={!text.trim() || pending} aria-label={t("send", lang)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </section>
  );
}
