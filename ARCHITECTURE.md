# Arcanum — Architecture

An AI-native 3D library: a cinematic world, an embodied AI librarian, a hybrid
semantic search engine and a voice layer, wired together by one state machine
(the **Journey Director**).

```
┌──────────────────────────── Browser (Next.js client) ────────────────────────────┐
│                                                                                   │
│  UI layer (React)            Journey Director (zustand store, state machine)      │
│  ├─ Gate / HUD / Chat  ───▶  gate → entering → greeting → listening → thinking    │
│  ├─ Voice (STT/TTS)          → walking → reaching → presenting → inspecting       │
│  └─ Book Inspector              │                         ▲                        │
│                                 ▼                         │ events                 │
│  3D layer (React Three Fiber)                                                     │
│  ├─ World: hall, gate, chunked sections (InstancedMesh shelves + books, LOD)      │
│  ├─ Librarian: avatar driver (procedural rig ⇄ GLTF rig), path follower           │
│  ├─ CameraDirector: cinematic rails + follow cam + user orbit                     │
│  └─ NavGrid + A* (aisle graph)                                                    │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ fetch /api/chat, /api/search, /api/book
┌─────────────────────────── Server (Next.js route handlers) ───────────────────────┐
│  Librarian Agent                                                                   │
│  ├─ LLMProvider  (openai | anthropic | gemini | ollama | rules)  ← swappable       │
│  ├─ Intent parse → { intent, query, filters, language, reply }  (JSON schema)      │
│  └─ Grounded answer generation about a selected book                               │
│  Search Engine                                                                     │
│  ├─ Query understanding (LLM / rules, EN + HI)                                     │
│  ├─ Candidate generation:                                                          │
│  │    • Vector search  (EmbeddingProvider → VectorIndex)                           │
│  │    • Lexical BM25   (title / author / subjects)                                 │
│  │    • External APIs  (Open Library, Google Books) → normalised + embedded        │
│  ├─ Metadata filters (author, genre, language, year, audience)                     │
│  ├─ Fusion: Reciprocal Rank Fusion + popularity/rating prior + diversity (MMR)     │
│  └─ Placement: book → section → bay → shelf → slot (deterministic, infinite)       │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## 1. Technology choices (and why)

| Concern | Choice | Why |
|---|---|---|
| App shell | **Next.js 15 (App Router) + TypeScript** | Route handlers host the AI/search backend next to the client; easy deploy to Vercel/Node. |
| 3D | **Three.js + React Three Fiber + Drei** | Declarative scene graph, Suspense-based lazy loading, `Instances`, `Detailed` (LOD), `AdaptiveDpr`, `PerformanceMonitor`. |
| Post FX | **@react-three/postprocessing** | Bloom, SMAA, vignette, tone mapping — disabled automatically on low-tier GPUs. |
| State | **zustand** | Tiny, works inside and outside React and inside `useFrame` without re-renders. |
| Animation | **maath easing + custom procedural rig** | Frame-rate independent damping; no physics engine needed for a walk/reach cycle. A physics engine (Rapier) is deliberately *not* used for the MVP — books follow scripted hand IK which is cheaper and more cinematic. |
| Pathfinding | **Grid/graph A\*** over aisle waypoints | The library is a regular lattice, so a waypoint graph is exact and ~µs to solve. Swap for `recast-navigation` when the layout becomes irregular. |
| LLM | **Provider interface** (OpenAI, Anthropic, Gemini, Ollama, offline rules) | Don't train a model; a hosted LLM with a JSON schema does intent parsing far better. Offline rule engine keeps the demo working with zero keys. |
| Embeddings | **Provider interface** (OpenAI `text-embedding-3-small`, Ollama `nomic-embed-text`, local hashed n-gram) | Semantic recall on descriptions/themes; the local hasher means no key is required. |
| Vector store | **`VectorIndex` interface**, in-memory cosine for MVP | Production: **pgvector** (if Postgres already exists) or **Qdrant** for >10M vectors with payload filtering. Same interface. |
| External catalog | **Open Library + Google Books** | Free, broad coverage → "every book on the internet". Results are normalised, embedded on the fly and cached. |
| STT | **Web Speech API** (`SpeechRecognition`, `en-IN` / `hi-IN`) | Zero-cost, low latency. Interface allows Whisper / Deepgram later. |
| TTS | **speechSynthesis** with gender/language-matched voices; optional server TTS (OpenAI) | Swappable `TTSProvider`. |
| Audio | **WebAudio synthesis** (room tone, footsteps, door, page rustle) | No asset downloads; spatial-ish via stereo panning. |

## 2. Search at "infinite" scale

The catalog is conceptually unbounded, so the engine never assumes all books
are local:

1. **Query understanding** — the LLM (or rules) turns *"mujhe ek emotional
   love story chahiye jo India mein set ho"* into
   `{ intent: "find_book", query: "emotional love story set in India", genre: "romance", language: "any" }`.
2. **Candidate generation in parallel**
   - local vector index (seed + previously cached external books),
   - BM25 lexical index (exact titles/authors win),
   - external APIs (Open Library, Google Books) for long-tail recall.
3. **Normalise + embed** external hits, add them to the index (the library
   *grows* as people search — a write-through cache).
4. **Filter** on structured metadata, then **fuse** with Reciprocal Rank Fusion,
   add a popularity/rating prior, and apply MMR for diversity.
5. **Placement** — every book has a stable home: its primary genre maps to a
   numbered *section*; a hash of its ID selects the bay, shelf and slot. New
   books from the internet therefore always appear on a real shelf, and the
   world can stream that section in on demand.

Production scaling path: move the index to Qdrant/pgvector, run nightly bulk
ingest of Open Library dumps (~40M editions) through a batch embedding job,
cache LLM intent parses by normalised query, add a learning-to-rank re-ranker
(e.g. a cross-encoder or Cohere/Voyage rerank) on the top 50.

## 3. World streaming, LOD and performance

- The library is an infinite grid of **sections** (numbered 1…N). Each section
  is a chunk with 2 rows × 4 bays of shelves.
- Only chunks within a radius of the camera are mounted (`SectionStreamer`).
- Each chunk renders all its books as **one InstancedMesh** (thousands of books
  → 1 draw call), shelves as another. Far chunks switch to a low-detail
  "book wall" (a single textured box) via `Detailed`.
- `PerformanceMonitor` + `AdaptiveDpr` drop DPR, shadows and post FX on
  weaker devices; mobile gets fewer chunks and no SSAO.
- Textures (spines, covers) are generated on a canvas and cached — no network.

## 4. Librarian

- `LibrarianAvatar` renders either a **procedural articulated rig** (default,
  male or female, randomly chosen on entry) or, if present, a **GLTF/GLB rig**
  at `public/models/librarian-{male|female}.glb` (Ready Player Me / Mixamo
  skeletons work). The behaviour layer drives both through the same pose API.
- Behaviours: idle breathing, greet wave, talk gestures + jaw, thinking (hand
  to chin, head tilt), walk (A* path following with turn smoothing), scan shelf,
  reach/pick (arm IK to the exact slot), present (book held forward).

## 5. Journey Director (state machine)

```
gate ─open─▶ entering ─arrive─▶ greeting ─spoken─▶ listening
listening ─user msg─▶ thinking ─results─▶ walking ─arrive─▶ reaching
reaching ─book in hand─▶ presenting ─user clicks─▶ inspecting
any ─user msg─▶ thinking  (conversation continues while walking/presenting)
```

The director owns the camera mode, the librarian's behaviour target and the
UI panel state, so every subsystem reacts to one source of truth.

## 6. Swapping providers

All providers are selected from env vars (see `.env.example`):

- `src/lib/ai/providers/*` — implement `LLMProvider.complete()`.
- `src/lib/search/embeddings.ts` — implement `EmbeddingProvider.embed()`.
- `src/lib/search/vectorIndex.ts` — implement `VectorIndex`.
- `src/lib/voice/*` — implement `STTProvider` / `TTSProvider`.
