import { handleChat } from "../src/lib/ai/librarian";
import type { Intent, Lang } from "../src/lib/types";

// [message, lang, lastIntent?]
const qs: [string, Lang, Intent?][] = [
  ["can you suggest me some books?", "en"],
  ["I like thrillers and I'm a casual reader", "en", "clarify"],
  ["show me some bestsellers", "en"],
  ["recommend some self help books for a student", "en"],
  ["what should I read?", "en"],
  ["I want a space survival story with humor", "en"],
  ["get me Dune", "en"],
  ["Dune", "en"],
  ["who wrote Hamlet?", "en"],
  ["what is the capital of France?", "en"],
  ["how are you?", "en"],
  ["mystery novels", "en"],
  ["कुछ अच्छी किताबें सुझाओ", "hi"],
  ["मुझे प्रेम कहानियाँ पसंद हैं, मैं कभी-कभी पढ़ता हूँ", "hi", "clarify"],
  ["mujhe ek emotional love story chahiye", "hi"],
  ["मुझे प्रेमचंद की किताब चाहिए", "hi"],
  ["take me to the history section", "en"],
  ["why library name is arcanum?", "en"],
  ["can you suggest me some book", "en", "general_question"],
  ["how many sections are there?", "en"],
  ["why this library name is arcanum?", "en", "find_book"],
];
(async () => {
  for (const [m, l, last] of qs) {
    const r = await handleChat({ message: m, lang: l, history: [], librarianName: "Asha", librarianGender: "female", currentBook: null, lastIntent: last ?? null });
    console.log(`\n> ${m}${last ? `  (after ${last})` : ""}\n  [${r.intent}/${r.lang}${r.target ? " → FETCH " + r.target.book.title : ""}] ${r.reply}\n  ${r.results?.map((h) => h.book.title).join(" | ") ?? ""}`);
  }
})();
(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const a = await handleChat({ message: "Thrillers & mystery", lang: "en", history: [], librarianName: "Asha", currentBook: null, lastIntent: "clarify" });
  const b = await handleChat({ message: "Something shorter", lang: "en", history: [], librarianName: "Asha", currentBook: null, lastIntent: a.intent, lastSearch: a.search });
  console.log("\n> Something shorter (after thrillers list)\n  [" + b.intent + "] " + b.results?.map((h) => `${h.book.title} (${h.book.pages}p)`).join(" | "));
})();
