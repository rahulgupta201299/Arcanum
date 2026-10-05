# Arcanum

An immersive, AI-native 3D library. Walk through the gate of an endless hall of
numbered sections, talk (or type) to a librarian in **English or Hindi**, and
watch them understand what you want, walk you to the right shelf, pull the exact
book out, and hand it to you to inspect in 3D.

Built with **Next.js 15 · TypeScript · Three.js · React Three Fiber · Drei ·
postprocessing · zustand**, a provider-agnostic **LLM** layer and a **hybrid
semantic search** engine. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the
design write-up.

## Quick start

```bash
npm install
cp .env.example .env.local     # optional: add an LLM key for richer conversation
npm run dev                    # http://localhost:3000
```

It works with **no API keys**: an offline bilingual NLU + local embeddings +
the seed catalogue power everything. Open Library and Google Books are queried
live when your network allows it, so the catalogue reaches far beyond the seed.

| Want | Set in `.env.local` |
|---|---|
| GPT-class conversation | `LLM_PROVIDER=openai`, `OPENAI_API_KEY=…` |
| Claude | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=…` |
| Gemini | `LLM_PROVIDER=gemini`, `GEMINI_API_KEY=…` |
| Local / private | `LLM_PROVIDER=ollama` (+ `OLLAMA_MODEL`) |
| Neural embeddings | `EMBEDDING_PROVIDER=openai` or `ollama` |
| Studio-quality voice | `TTS_PROVIDER=openai` (uses `OPENAI_API_KEY`) |

## The journey

1. **Gate** — night exterior, lanterns, "Open the doors" (EN/हि toggle).
2. **Doors swing open** with a procedural creak; ambience fades in.
3. **Cinematic dolly** through the arch into the domed foyer.
4. A **randomly chosen male or female librarian** waits at the desk, waves and greets you (voice + text).
5. **Talk** by text or the mic (it waits for a ~2 s pause, so you can speak whole sentences):
   - *"Can you suggest me some books?"* → the librarian asks what you enjoy and what you are, or offers bestsellers.
   - *"Some thrillers, I'm a casual reader"* / *"show me bestsellers"* → a **list of recommendations** as cards; nothing moves until you pick one.
   - *"Get me Dune"*, *"I want a funny space-survival novel"*, *"प्रेमचंद की किताब चाहिए"* → a specific book: they go and fetch it.
   - *"How are you?"*, *"Who wrote Hamlet?"* → just a friendly answer (with an LLM key, any general question).
6. The librarian **thinks** (hand to chin, holographic catalogue cards orbit them) while the agent parses intent and searches.
7. They **walk** with you (A* over the aisle graph, smoothed path, glowing guide trail, footsteps) to the numbered section.
8. They **scan** the shelf, the exact book **glows**, they **reach** (two-bone arm IK, crouching for low shelves), **pull it out** and…
9. …**turn and present** it to you with both hands.
10. **Inspect** the book: rotate, zoom, open the cover to the title page.
11. Keep talking: "who wrote this?", "इसके बारे में बताओ", "find something similar", or click an alternative — they'll fetch it.

Extras: drag to look around · **Explore mode** (walk icon) for free WASD movement ·
graphics tiers HQ/MQ/LQ with automatic downgrade · `?q=low|medium|high`, `?lang=hi` URL params.

## Project layout

```
src/
  app/api/          chat · search · section · status · tts route handlers
  lib/ai/           librarian agent, LLM providers, offline NLU (EN + HI)
  lib/search/       hybrid engine: embeddings, vector index, BM25, external sources, lexicon
  lib/world/        shared layout (book → shelf address), nav graph + A*, runtime channels, textures
  lib/voice/        STT/TTS provider interfaces (Web Speech, server TTS)
  lib/audio/        procedural WebAudio sound design
  components/world/ scene, building, gate, streamed sections (instancing + LOD), director, camera rig
  components/librarian/  procedural articulated avatar, GLTF avatar loader, hologram FX
  components/ui/    gate screen, HUD, chat, recommendation cards, book card
  components/inspector/  3D book inspector
  data/             seed catalogue (≈130 books across 16 sections)
```

## Deploying (GitHub → Vercel, auto-deploy)

1. Push this folder to a GitHub repository (see the commands in the chat / below).
2. In Vercel: **Add New → Project → Import** that repository. Framework preset: *Next.js* (auto-detected) — no build settings to change.
3. Optional: add the environment variables from `.env.example` (e.g. `LLM_PROVIDER`, `OPENAI_API_KEY`) under *Settings → Environment Variables*.
4. Every push to `main` now deploys automatically; pull requests get preview URLs. CI (`.github/workflows/ci.yml`) type-checks and builds each push.

```bash
git remote add origin https://github.com/<you>/arcanum-ai-library.git
git push -u origin main
```

## Using a photoreal librarian

The default avatar is a fully procedural rig (no downloads). For a realistic
human, drop rigged GLBs in `public/models/` — see `public/models/README.md`.
The behaviour system (walk, reach, present, look-at, lip-sync flag) drives
either rig through the same channels.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck`
- `npm run test:search` — runs a bilingual set of librarian queries through the agent offline

## Browser notes

Voice input uses the Web Speech API (Chrome, Edge, Safari). Text-to-speech uses
the system voices; installing a Hindi voice (e.g. Google हिन्दी, Lekha) gives
the best Hindi speech. Sound starts after the first click (browser autoplay rules).
