# Mock Feedback — AI-Powered Mock Interviewer

## Context
Building a web app (eventually desktop via Tauri) that helps developers practice technical interviews. The AI interviewer speaks questions aloud, the user answers verbally, and after a configurable number of questions, the AI provides detailed text feedback on each answer.

## Core Flow
1. User lands on home page → clicks "Start" → configures session (topic, number of questions)
2. AI introduces itself via voice + text, asks first question
3. User speaks full answer → mic records → audio sent to OpenAI Transcribe
4. Transcript sent to OpenAI GPT → generates next question → speaks it via TTS
5. Repeat for N questions (user-configured)
6. After final answer → GPT generates structured text feedback for all answers (rating + commentary per question + overall summary)
7. Feedback displayed in a modal/page, saved to IndexedDB
8. User can view past sessions from History page

## Tech Stack

### Frontend
| Layer | Choice | Why |
|---|---|---|
| **Framework** | Vite + React 19 | Lightweight, no SSR baggage, ideal for local-first + future Tauri |
| **Language** | TypeScript | Type safety, consistent with user's other projects |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Fast development, consistent design system |
| **Storage** | IndexedDB (via Dexie.js or idb) | Local-first, no auth needed, works in Tauri webview |
| **State** | React Context + useReducer (or Zustand if needed) | Simple, no over-engineering |
| **Routing** | React Router v7 | Client-side routing for SPA |

### AI / Voice Stack (All OpenAI)
| Layer | Model | Price | Notes |
|---|---|---|---|
| **STT** | GPT-4o Mini Transcribe | $3.00/1K min | Batch transcription after user finishes speaking. Prompt param for tech term hints. |
| **LLM** | GPT-4o-mini (or GPT-4o for higher quality) | $0.15-0.60/1M tokens | Generates questions, follow-ups, and structured feedback |
| **TTS** | gpt-4o-mini-tts | $0.60/1M chars | Streaming HTTP, "instructions" param for interview tone |

**Cost per session:** ~$0.10-0.15 for a 5-7 question interview (~15 min)

### Testing
| Layer | Choice | Why |
|---|---|---|
| **Unit / Component** | Vitest + React Testing Library | Native Vite integration (zero config), fast HMR-aware runner, RTL for behavior-driven component tests |
| **E2E** | Playwright | Multi-browser, fast parallel runs, built-in auto-wait, great for async flows (mic, audio, modals) |
| **Mocking** | MSW (Mock Service Worker) | Intercept OpenAI API calls in tests without hitting real APIs |

### Desktop (Phase 2 — future)
| Layer | Choice | Why |
|---|---|---|
| **Wrapper** | Tauri v2 | Lightweight (~5-10MB), uses system webview, Rust backend |
| **Storage** | Same IndexedDB (via webview) or SQLite via Tauri plugin | |
| **Voice** | Same OpenAI APIs (works in Tauri webview) | |

### Deployment (Web)
| Layer | Choice |
|---|---|
| **Hosting** | Vercel (static site, auto-deploy from `main`) |
| **CI/CD** | GitHub Actions — runs lint + unit tests + E2E + build verification on every push/PR |
| **Preview Deploys** | Vercel PR previews — every PR gets a unique preview URL automatically |
| **API Key** | User provides their own OpenAI key (stored in IndexedDB) — never sent anywhere except OpenAI |

### CI Pipeline (GitHub Actions)
Every push and pull request triggers:
1. **Lint** — `npm run lint` + `npm run format:check`
2. **Unit Tests** — `npm run test` (Vitest)
3. **E2E Tests** — `npm run test:e2e` (Playwright)
4. **Build Verification** — `npm run build` (ensures production build succeeds, no type errors)

All four must pass before merge. Vercel auto-deploys `main` to production and generates preview URLs for PRs.

## Interview Topics (Phase 1)
- JavaScript / TypeScript fundamentals
- React & Next.js
- Node.js
- Behavioral / STAR interviews

## Pages & Components

### Pages
1. **Home** (`/`) — Previous sessions list + Start button
2. **Session** (`/session`) — Active interview (voice conversation UI)
3. **History** (`/history`) — Grid of past sessions with stats
4. **Feedback** (`/history/:id`) — Detailed feedback for a specific session

### Key Components
- `StartModal` — Topic selection, question count config, "How it works" info
- `InterviewSession` — Mic recording, AI voice playback, question display, stop button
- `SessionCard` — History card (topic, date, duration, question count, score)
- `SettingsModal` — API key management (add/update/remove key), opened from header "Settings" button
- `FeedbackView` — Per-question rating + commentary + overall summary (rendered as a full page at `/history/:id`, not a modal)
- `AudioRecorder` — Mic capture using MediaRecorder API
- `VoicePlayer` — Play OpenAI TTS audio stream

## Data Model (IndexedDB)

```typescript
interface Session {
  id: string;
  topic: string;
  createdAt: Date;
  duration: number; // seconds
  questionCount: number;
  averageScore: number;
  questions: Question[];
}

interface Question {
  id: string;
  questionText: string;
  userTranscript: string;
  rating: number; // 1-10
  feedback: string;
  followUp?: string;
}
```

## API Key Strategy (BYOK — Bring Your Own Key)
This app does NOT ship with or use any developer-owned API keys. Users MUST provide their own OpenAI API key to use the app.

- API key input is the **first thing shown** to new users (gate before any AI features)
- Key stored in IndexedDB (never sent anywhere except OpenAI directly from the browser)
- "Start" button is disabled until a valid key is saved
- Settings modal (opened from header) allows updating or removing the key at any time — no dedicated `/settings` route
- Clear messaging: "This app requires your own OpenAI API key. Your key is stored locally and never sent to any server except OpenAI."

---

## Phase 1 — UI (All screens, components, and navigation with mock data)

No tests in this phase — just build and visually verify.

### 1.1 Project Scaffolding
- Initialize Vite + React + TypeScript project
- **TypeScript config (`tsconfig.json`):** strict mode, `noUnusedLocals: true`, `noUnusedParameters: true`, path aliases (`@/` → `src/`)
- **Vite env typing:** add `src/vite-env.d.ts` with `ImportMetaEnv` interface for type-safe `import.meta.env` access
- **Vite config (`vite.config.ts`):** code splitting via `manualChunks` (vendor, UI lib, OpenAI SDK split into separate chunks), `treeshake: true`, `build.rollupOptions` for dead code elimination, chunk size warnings
- **Environment files:**
  - `.env.example` — committed to repo, documents all env vars:
    ```
    # App config
    VITE_APP_NAME=Mock Feedback
    VITE_OPENAI_BASE_URL=https://api.openai.com/v1

    # Feature flags (optional)
    VITE_MAX_RECORDING_SECONDS=240
    VITE_SILENCE_TIMEOUT_SECONDS=10
    ```
  - `.env.local` — gitignored, for local developer overrides (e.g., proxy URL, debug flags)
  - `.env.test` — test-specific config (MSW base URL to intercept)
- **`.gitignore`:** add day-zero gitignore:
  ```
  .env
  .env.local
  .env.*.local
  node_modules/
  dist/
  coverage/
  playwright-report/
  test-results/
  .DS_Store
  *.tsbuildinfo
  ```
- **ESLint:** install `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-plugin-jsx-a11y` (accessibility linting from day 1). Configure flat config (`eslint.config.js`)
- **Prettier:** install `prettier`, `eslint-config-prettier`. Configure `.prettierrc` (semi, singleQuote, trailingComma, printWidth). Add `format` and `format:check` scripts
- **Lint scripts:** `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`
- Install and configure Tailwind CSS v4
- Initialize shadcn/ui and add base components (Button, Dialog, Card, Badge, Input, Select)
- Set up React Router v7 with route structure (`/`, `/session`, `/history`, `/history/:id`)
- Create base layout component (header with logo, "History" button, "Settings" button — Settings opens a modal, not a route)
- **Global Error Boundary:**
  - Create a root-level `ErrorBoundary` component wrapping the entire app — catches unexpected render errors, shows a "Something went wrong" fallback with a "Reload" button
  - Create a session-specific `SessionErrorBoundary` wrapping the `/session` route — catches crashes during interview (e.g., malformed API response, audio failure) without nuking the entire app. Shows "Session encountered an error" with option to save partial progress and return home
  - Both boundaries log error details to console for debugging
- Verify production build: `npm run build` → check bundle output for code splitting (separate chunks), no unused JS in output, tree shaking working

### 1.2 Home Page
- Build home page layout with "Recent Sessions" section (shows last 3-5 sessions as compact cards)
- "Your past interview sessions will appear here" empty state when no sessions exist
- "How does it work?" info button
- Large circular "Start" button (centered, green, prominent)

### 1.3 Start Modal
- "Welcome to Mock Feedback!" modal on Start click
- "How it works" numbered steps (1-5)
- Topic selection dropdown (JS/TS, React/Next.js, Node.js, Behavioral)
- Question count selector (3, 5, 7, 10)
- "Got it!" / "Start Session" button → navigates to `/session`

### 1.4 Interview Session Page (UI only — mock data)
- Display current topic header (e.g., "Performance & Optimization")
- AI message bubble (styled, with text of current question)
- Mic recording indicator (visual feedback — pulsing animation when "recording")
- Large circular "Stop" button (centered, purple/blue)
- Question counter (e.g., "Question 2 of 5")
- Mock conversation flow with hardcoded questions for visual testing

### 1.5 History Page
- "My Interview History" header
- Quick stats bar (interviews completed, avg score, last interview date)
- Grid of session cards (3-column responsive)
- Each `SessionCard`: topic, session number, date/time, duration, question count, category badge, first question preview, rating, "View detailed Feedback" link
- Empty state when no history

### 1.6 Feedback Page (`/history/:id`)
- Dedicated feedback page (not a modal) with scrollable content
- Dropdown to toggle view: "Model Answers" / "Detailed Feedback"
- Per-question section: question text, rating (X/10), detailed feedback paragraph
- "Overall Performance Summary" section at the bottom
- "Continue" button to close/return

### 1.7 API Key Gate + Settings
- **First-run experience:** If no API key is stored, show a full-screen prompt asking the user to enter their OpenAI API key before anything else
- Clear copy: "This app requires your own OpenAI API key. Your key stays on your device and is only sent to OpenAI."
- Link to OpenAI's API key page for convenience
- OpenAI API key input field (password-masked, with show/hide toggle)
- "Save" button → stores key in IndexedDB
- Validation: test API key with a lightweight OpenAI call (e.g., list models)
- Status indicator (key saved / not configured / invalid)
- "Start" button on home page is disabled + shows tooltip when no key is configured
- Settings modal (accessible from header "Settings" button) allows updating or removing the key at any time

### 1.8 IndexedDB Layer (with mock data)
- Set up Dexie.js with `sessions` table
- CRUD functions: `createSession`, `getSession`, `getAllSessions`, `deleteSession`
- Seed with 3-4 mock sessions for UI development
- Wire up Home page and History page to read from IndexedDB

---

## Phase 2 — Accessibility + Unit Tests

### 2.1 Accessibility Audit & Fixes
Make the app fully accessible (WCAG 2.1 AA compliant):

**Semantic HTML & ARIA:**
- All pages use proper landmarks: `<header>`, `<main>`, `<nav>`, `<section>`, `<aside>`
- All interactive elements are focusable and have accessible names (`aria-label`, `aria-labelledby`)
- Modals: focus trap on open, return focus on close, `role="dialog"`, `aria-modal="true"` (shadcn Dialog handles most of this — verify)
- Form inputs: proper `<label>` associations, error messages linked via `aria-describedby`
- Session cards: `role="article"` or semantic `<article>`, link is keyboard-activatable
- Status updates (recording state, transcribing, AI speaking): use `aria-live="polite"` regions

**Keyboard Navigation:**
- Full keyboard navigation through all flows (Tab, Shift+Tab, Enter, Escape)
- Start button, modal interactions, session controls, history cards — all keyboard-operable
- Visible focus indicators on all interactive elements (Tailwind `focus-visible:ring-2`)
- Skip-to-content link at the top of the page

**Color & Visual:**
- Contrast ratio ≥ 4.5:1 for all text (verify with axe or Lighthouse)
- No information conveyed by color alone (ratings use numbers + color, not just color)
- Reduced motion: respect `prefers-reduced-motion` for animations (pulsing mic indicator, etc.)

**Screen Reader:**
- Recording state announced: "Recording started", "Recording stopped"
- Question counter announced: "Question 2 of 5"
- Feedback scores announced meaningfully: "Rating: 7 out of 10"

**Tooling:**
- `eslint-plugin-jsx-a11y` already added in Phase 1.1 — verify all rules passing
- Run Lighthouse accessibility audit — target score: **100**
- Manual keyboard-only walkthrough of all flows

### 2.2 Unit Test Setup
- Install and configure Vitest + React Testing Library + jsdom + `@testing-library/user-event`
- Configure test scripts: `npm run test`, `npm run test:watch`, `npm run test:coverage`
- Set up test utilities: custom `renderWithProviders` wrapper (Router + context providers), mock IndexedDB (`fake-indexeddb`)

### 2.3 Testing Principles

All tests in this codebase MUST follow these principles. This favors small, readable test suites with explicit setup and minimal magic. Individual tests follow a meaningful workflow end-to-end, even when that makes a single test longer and more assertion-heavy.

**Core rules:**

1. **Fewer, longer tests** (Kent C. Dodds style). Treat each test like a manual tester's script: one setup, then as many actions and assertions as needed to validate the whole journey. Do NOT split a single flow into many tiny tests to satisfy "one assertion per test." Multiple related assertions in one test are a feature, not a smell.
2. **Flat test files.** Use top-level `test(...)`. Avoid `describe` nesting.
3. **Inline setup per test.** No `beforeEach`/`afterEach`. No shared mutable state across tests. If the next assertion depends on the same rendered object, it belongs in the same test.
4. **Factory pattern over globals.** Build helpers that return ready-to-run objects, not shared globals.
5. **Don't test what the type system guarantees.** TypeScript already enforces prop types, return types, etc. Don't duplicate that in tests.
6. **Test behavior, not implementation.** Never test internal state, private methods, or component internals. Test what the user sees and does.
7. **Query priority (React Testing Library):**
   - `getByRole` (first choice — matches how screen readers see the page)
   - `getByLabelText` (form fields)
   - `getByText` (non-interactive content)
   - `getByTestId` (absolute last resort — avoid)
8. **Use `userEvent` over `fireEvent`.** `userEvent` simulates real browser behavior.
9. **No shallow rendering.** Render the full component tree.
10. **Avoid mocking what you don't own.** Use MSW to mock HTTP boundaries (OpenAI API), not internal modules.
11. **Tests run offline.** No reliance on public internet or third-party services. Prefer local fakes/fixtures.
12. **Keep the bar high for adding tests.** Especially slower integration and E2E tests. Don't add regression tests for bugs unlikely to recur unless the flow justifies the maintenance cost.
13. **Assert intermediate states inline.** Prefer asserting loading/transition states inside the broader workflow, not as isolated tests.
14. **No string-blob assertions.** Don't assert that a string contains incidental copy. Favor behavior-focused assertions (structured output, user-visible outcomes, stable contracts).
15. **Test intent in the name.** e.g., `"user can start a new interview by selecting a topic and question count"`

**Example pattern:**
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

test('user can start a new interview session', async () => {
  const user = userEvent.setup()
  render(<App />)

  // Start button visible
  await user.click(screen.getByRole('button', { name: /start/i }))

  // Modal opens — select topic and count in same flow
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await user.click(screen.getByRole('combobox', { name: /topic/i }))
  await user.click(screen.getByRole('option', { name: /javascript/i }))
  await user.click(screen.getByRole('button', { name: /start session/i }))

  // Navigated to session page
  expect(screen.getByRole('heading', { name: /javascript/i })).toBeInTheDocument()
  expect(screen.getByText(/question 1 of/i)).toBeInTheDocument()
})
```

**Test commands:**
- `npm run test` — Vitest unit/component tests only
- `npm run test:watch` — Vitest in watch mode
- `npm run test:coverage` — with coverage report
- `npm run test:e2e` — Playwright (Phase 5 only)

### 2.4 Component & Page Tests
- `Home` — user sees empty state, Start button visible, Start button disabled when no API key, clicking Start opens modal
- `StartModal` — user opens modal, selects topic from dropdown, picks question count, submits → navigates to `/session`
- `SessionCard` — user sees topic, date, duration, rating; clicking "View Feedback" navigates to feedback page
- `FeedbackView` (page) — user sees all questions with ratings, toggles between "Model Answers" / "Detailed Feedback", clicks "Back" to return to history
- `APIKeyGate` — new user sees key prompt, enters key, saves, sees success; returning user goes straight to home
- `History page` — user sees session cards grid, quick stats bar, empty state when no sessions
- `Session page` — user sees topic header, AI message bubble, Stop button, question counter
- `Feedback page` — user sees all questions with ratings and feedback text, overall summary

### 2.5 Data Layer Tests
- IndexedDB CRUD: `createSession`, `getSession`, `getAllSessions`, `deleteSession` against `fake-indexeddb`
- API key storage: save, retrieve, delete, validate key exists
- Mock data seeding: verify seed data loads correctly

### 2.6 Hook Tests
- `useApiKey` — returns key status, saves key, clears key
- Any navigation/routing hooks — verify route transitions

**Exit criteria:** `npm run test` passes, >80% coverage on components and data layer. All `getByRole` queries confirm accessibility. `npm run lint` clean (including jsx-a11y rules).

---

## Phase 3 — OpenAI Integration (wire up real AI with basic prompts)

### 3.1 OpenAI Client Setup
- Create `openai.ts` service module using the `openai` npm package
- Read API key from IndexedDB
- Error handling wrapper (rate limits, invalid key, network errors)

### 3.2 STT Integration (Speech-to-Text)
- Build `useAudioRecorder` hook: `getUserMedia()` → `MediaRecorder` → `Blob`
- Create `transcribeAudio(blob)` function → calls OpenAI GPT-4o Mini Transcribe
- Add tech term hints via prompt parameter (e.g., "React, useState, async/await, Node.js")
- Wire into Session page: user stops speaking → transcribe → display transcript
- **Audio format handling:** detect browser codec (`webm/opus` on Chrome, `mp4/aac` on Safari) and ensure output is in a format OpenAI Transcribe accepts. Normalize to `webm` or `mp4` based on browser support.

### 3.3 LLM Integration (Question Generation)
- Create `generateNextQuestion(topic, history)` function
- Basic system prompt: "You are a senior developer conducting a {topic} interview..."
- Pass conversation history (previous Q&A pairs) for context-aware follow-ups
- Wire into Session page: after transcription → call LLM → get next question text

### 3.4 TTS Integration (Text-to-Speech)
- Create `speakText(text)` function → calls OpenAI gpt-4o-mini-tts
- Streaming audio playback using `AudioContext` or `<audio>` element
- Instructions parameter: "Speak in a calm, professional tone like a senior engineer conducting a technical interview"
- Wire into Session page: AI question text → TTS → audio plays → text displays simultaneously

### 3.5 Full Interview Loop
- Wire together: TTS plays question → mic records answer → STT transcribes → LLM generates next question → repeat
- Session state machine: `idle` → `ai_speaking` → `user_recording` → `transcribing` → `generating` → `ai_speaking` → ... → `completed` → `error`
  - `error` state is reachable from any active state (API failure, mic loss, network drop)
  - From `error`: user can retry (re-enter previous state) or abort (save partial session, go home)
- Timer tracking (session duration)
- **Request cancellation:** use `AbortController` for all in-flight OpenAI API calls. When user navigates away or stops session, cancel pending requests to avoid memory leaks, orphaned state updates, and wasted API credits
- **Session persistence on navigation:** if user navigates away (back button, closes tab, refreshes) mid-session, save partial session to IndexedDB via `beforeunload` event. Show a `window.confirm` prompt: "You have an active interview session. Are you sure you want to leave? Your progress will be saved."
- **User clicks Stop mid-session:** stop recording, cancel any in-flight API calls, generate feedback for answered questions only, save partial session

### 3.6 Audio & Microphone Edge Cases
All edge cases for microphone and audio recording, handled explicitly:

- **Browser doesn't support `MediaRecorder`:** detect on app load via `typeof MediaRecorder === 'undefined'`. Show a full-screen fallback: "Your browser doesn't support audio recording. Please use a recent version of Chrome, Firefox, or Safari." Block session start.
- **No audio input devices detected:** check `navigator.mediaDevices.enumerateDevices()` before session start. If no `audioinput` devices found, show alert: "No microphone detected. Please connect a microphone and try again." with a "Retry" button that re-checks devices. **Block session start** — do not let the user enter `/session` without a detected mic.
- **Mic permission denied:** if `getUserMedia()` rejects with `NotAllowedError`, show a persistent banner: "Microphone access is required for the interview. Please allow microphone access in your browser settings and reload the page." Include browser-specific instructions link. Block recording.
- **Mic permission dismissed (closed without choosing):** treat same as denied — show the permission-needed prompt.
- **Mic permission revoked mid-session:** listen for `MediaRecorder.onerror` and `MediaStreamTrack.onended` events. If mic access is lost during recording, immediately pause the session, show modal: "Microphone access was lost. Please re-enable microphone permissions to continue." Offer "Resume" (re-requests permission) or "End Session" (saves partial progress).
- **Silence detection (10-second timeout):** monitor audio levels via `AnalyserNode` from Web Audio API during recording. If no voice activity detected for 10 seconds continuously:
  - Show a visible timer/countdown in the UI: "Silence detected — X seconds remaining"
  - After 10 seconds of silence: AI responds contextually — either moves to the next question ("Let's move on to the next question") or prompts the user ("I didn't catch a response — could you please share your thoughts on this?")
  - **UI must clearly communicate this rule:** show text near the mic indicator: "Maximum silence: 10 seconds"
- **Max recording duration (4 minutes):** hard cap per answer to avoid hitting OpenAI's 25MB file size limit.
  - Show a visible timer counting up during recording
  - At 3:30, show a warning: "30 seconds remaining"
  - At 4:00, auto-stop recording and proceed to transcription
  - **UI must clearly communicate this rule:** show "Max answer length: 4 minutes" in the session interface

### 3.7 OpenAI API Error Handling
Explicit handling for every API failure mode:

- **Invalid API key (401):** show alert "Your API key is invalid. Please update it in Settings." Redirect to API key settings.
- **Quota exhausted (429 — billing):** show alert "Your OpenAI API quota is exhausted. Please add credits to your OpenAI account to continue." Link to OpenAI billing page. Block session start.
- **Rate limited (429 — rate):** retry with exponential backoff (1s → 2s → 4s), max 3 retries. If all retries fail, show "OpenAI is temporarily busy. Please wait a moment and try again."
- **Model not available (404):** show "The required AI model is not available on your OpenAI account. Please ensure you have access to GPT-4o Mini." (Some accounts are restricted to certain models.)
- **Network failure:** show inline error in session UI: "Connection lost. Check your internet and click Retry." Offer retry button. Do not auto-retry network errors — the user may be offline.
- **Malformed LLM response:** if JSON parsing fails on feedback/question generation, retry once with a stricter prompt. If second attempt also fails, show raw text response as fallback rather than crashing.
- **Request timeout:** set timeouts per call type — STT: 30s, LLM: 20s, TTS: 15s. On timeout, show "Request timed out. Click Retry to try again."
- **TTS streaming failure mid-playback:** if audio stream drops, show the question as text-only and continue the session. Do not block the interview flow for TTS failures.

### 3.8 Feedback Generation
- Create `generateFeedback(topic, questions[])` function
- Basic prompt: "Evaluate each answer. For each question provide a rating 1-10 and detailed feedback. End with an overall performance summary."
- Parse structured response into `Question[]` with ratings and feedback
- Save completed session to IndexedDB
- Wire into Feedback page to display real generated feedback

**Exit criteria:** Complete a full interview session end-to-end with real OpenAI API — AI speaks, user answers, transcription works, feedback generated and displayed.

---

## Phase 4 — Prompt Refinement (improve question quality and feedback depth)

### 4.1 Interview Question Prompts
- Refine system prompt with interviewer persona (years of experience, interview style)
- Add difficulty levels: junior / mid / senior (affects question complexity)
- Topic-specific prompt templates:
  - **JS/TS:** closures, event loop, prototypes, async patterns, type system
  - **React/Next.js:** hooks, rendering, state management, SSR/SSG, performance
  - **Node.js:** event loop, streams, clustering, middleware, error handling
  - **Behavioral:** STAR format guidance, follow-up probing, soft skill evaluation
- Adaptive follow-ups: if answer is weak → ask a simpler clarifying question; if strong → ask a deeper one
- Prevent question repetition within a session

### 4.2 Feedback Prompt Refinement
- Structured output format (enforce JSON schema via function calling or response_format)
- Per-question feedback: what was good, what was missed, model answer suggestion
- Scoring rubric: technical accuracy (40%), completeness (30%), communication clarity (30%)
- Overall performance summary with strengths, areas to improve, and recommended study topics
- Comparison to expected senior/mid/junior level answers

### 4.3 TTS Voice Tuning
- Experiment with different "instructions" for interview tone per topic
- Adjust pacing (slower for complex questions, natural pauses)
- Test different OpenAI voices (alloy, echo, fable, onyx, nova, shimmer) for best interviewer feel

**Exit criteria:** Run 5+ mock interviews across different topics and difficulty levels. Feedback quality is consistently useful and accurately scored.

---

## Phase 5 — E2E Tests + Integration Tests (Playwright + MSW)

### 5.1 Test Infrastructure Setup
- Install and configure Playwright
- Configure MSW (Mock Service Worker) to intercept all OpenAI API calls in test environment
- Create mock responses: sample transcription, sample LLM question, sample TTS audio blob, sample feedback
- Configure test scripts: `npm run test:e2e`, `npm run test:e2e:headed` (for debugging)

### 5.2 Integration Tests (Vitest + MSW — no browser needed)
- OpenAI client: initialization, error handling (invalid key, rate limit, network failure)
- `transcribeAudio()`: sends blob, receives transcript (MSW-mocked)
- `generateNextQuestion()`: sends history, receives question (MSW-mocked), verify conversation history passed correctly
- `speakText()`: sends text, receives audio blob URL (MSW-mocked)
- `generateFeedback()`: sends Q&A pairs, receives structured feedback (MSW-mocked), verify parsing
- Session state machine: transitions through all states correctly, handles error states

### 5.3 E2E Happy Path Tests (Playwright)
- **Full interview flow:** Home → Start modal (select topic + count) → Session page → AI speaks (mocked) → user "records" (mocked audio) → transcription → next question → Stop → Feedback displayed → navigate to History → session card visible
- **API key flow:** First visit → API key gate shown → enter key → save → home page accessible → Start button enabled
- **History + feedback:** Seed IndexedDB → History page loads cards → click card → Feedback page renders all questions with ratings

### 5.4 E2E Edge Case Tests (Playwright)
- No API key → Start button disabled, gate blocks navigation
- Invalid API key → error message shown, not saved
- Mid-session stop → partial session saved, feedback generated for answered questions only
- Empty history → empty state rendered correctly
- Network error during session → graceful error message, option to retry

### 5.5 Prompt Regression Tests (separate command — not in CI)
- Create a test suite of known Q&A pairs with expected feedback quality
- Snapshot tests: run prompts against OpenAI, verify output structure matches schema
- Grade boundary tests: verify a clearly bad answer scores low, a good answer scores high
- Run via `npm run test:prompts` — uses real OpenAI API, costs money, non-deterministic

**Exit criteria:** `npm run test` (unit) + `npm run test:e2e` (Playwright) all green. Coverage >80% on components and services.

---

## Verification Checklist

### Build & Quality
- [ ] `npm run dev` — app starts, all pages render
- [ ] `npm run build` — production build succeeds, correct chunks, no bundle size regressions
- [ ] `npm run lint` — clean (including jsx-a11y rules)
- [ ] `npm run format:check` — clean
- [ ] `.gitignore` is in place, no secrets committed
- [ ] `.env.example` is committed and documents all env vars

### Tests
- [ ] `npm run test` — all Vitest unit/component tests pass (Phase 2)
- [ ] `npm run test:e2e` — all Playwright E2E tests pass (Phase 5)
- [ ] CI pipeline (GitHub Actions) passes: lint + unit tests + E2E + build

### Core Functionality
- [ ] Full interview session end-to-end with real OpenAI API
- [ ] Mic permission → AI speaks → user answers → transcription → next question → feedback
- [ ] IndexedDB stores session data correctly
- [ ] History page loads past sessions, feedback page shows ratings
- [ ] Test with different topics and question counts (3, 5, 7, 10)

### Edge Cases & Error Handling
- [ ] No mic detected → session blocked, clear message shown
- [ ] Mic permission denied → prompt shown with instructions
- [ ] Mic permission revoked mid-session → session paused, re-permission prompt
- [ ] 10-second silence timeout → AI prompts user or moves to next question
- [ ] 4-minute recording cap → auto-stops with warning at 3:30
- [ ] Invalid API key → alert with redirect to settings
- [ ] Quota exhausted → alert with link to OpenAI billing
- [ ] Network error during session → inline error with retry option
- [ ] Tab close / navigate away during session → partial session saved
- [ ] Unsupported browser (no MediaRecorder) → fallback message shown

### Lighthouse Scores
- [ ] Lighthouse Accessibility score: **100**
- [ ] Lighthouse Performance score: **100**

### Cross-Browser
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Tested in Safari
- [ ] Mic permission flow verified in each browser
