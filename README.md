# Mock Feedback

AI-powered mock interviewer that helps developers practice technical interviews. The AI asks questions via voice, you answer verbally, and you get detailed feedback with ratings.

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **AI / Voice:** OpenAI (GPT-4o Mini for LLM + STT, gpt-4o-mini-tts for TTS)
- **Storage:** IndexedDB (Dexie.js) — fully local, no backend
- **Testing:** Vitest + React Testing Library + MSW
- **CI:** GitHub Actions (lint + format + test + build)
- **Pre-commit:** Husky + lint-staged

## BYOK (Bring Your Own Key)

This app requires your own OpenAI API key. Your key is stored in IndexedDB on your device and is only sent to OpenAI directly from the browser. No keys are shipped, hardcoded, or proxied.

## How It Works

1. Configure your OpenAI API key (first-run gate)
2. Click **Start** → select a topic and question count
3. AI asks questions via text-to-speech
4. You answer verbally — mic records → audio sent to OpenAI STT
5. After all questions, AI generates structured feedback (rating + commentary per question)
6. Feedback saved to IndexedDB, viewable anytime from History

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command                 | Description                   |
| ----------------------- | ----------------------------- |
| `npm run dev`           | Start dev server              |
| `npm run build`         | Type-check + production build |
| `npm run preview`       | Preview production build      |
| `npm run lint`          | ESLint (includes jsx-a11y)    |
| `npm run lint:fix`      | ESLint with auto-fix          |
| `npm run format`        | Prettier write                |
| `npm run format:check`  | Prettier check                |
| `npm run test`          | Vitest unit/component tests   |
| `npm run test:watch`    | Vitest in watch mode          |
| `npm run test:coverage` | Vitest with coverage report   |
| `npm run lighthouse`    | Lighthouse CI audit           |

## Interview Topics

- JavaScript / TypeScript
- React & Next.js
- Node.js
- Behavioral / STAR

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ApiKeyGate/      # First-run API key prompt
│   ├── ErrorBoundary/   # Root + session error boundaries
│   ├── Layout/          # Header, nav, skip-to-content
│   ├── SessionCard/     # Interview session card
│   ├── SettingsModal/   # API key management modal
│   ├── StartModal/      # Topic + question count selection
│   └── ui/              # shadcn/ui primitives
├── pages/               # Route-level components (lazy-loaded)
│   ├── Home/            # Recent sessions + Start button
│   ├── Session/         # Active interview UI
│   │   ├── ConversationLog   # Q&A history display
│   │   ├── MicCheckGate      # Mic permission + device check
│   │   ├── RecordingTimer    # Elapsed time + max duration warning
│   │   ├── SessionErrorDisplay
│   │   ├── SessionHeader
│   │   └── StatusIndicator   # State-aware status label
│   ├── History/         # Past sessions grid + stats
│   └── Feedback/        # Per-question ratings + feedback
├── hooks/               # React hooks + context
│   ├── ApiKeyContext/   # Shared API key state provider
│   ├── useApiKey/       # API key consumer hook
│   ├── useAudioRecorder/# MediaRecorder wrapper (start/stop/blob)
│   ├── useInterviewSession/ # Interview state machine + side effects
│   └── useSessions/     # Sessions data hook
├── services/            # OpenAI API integration
│   ├── openai.ts        # Client factory (cached, reads key from IDB)
│   ├── openaiErrors.ts  # Error classification + timeout signals
│   ├── llm.ts           # Question generation (chat completions)
│   ├── stt.ts           # Speech-to-text (audio transcriptions)
│   ├── tts.ts           # Text-to-speech (audio speech + playback)
│   ├── feedback.ts      # Structured feedback generation
│   └── feedbackParser.ts# JSON parsing + rating clamping
├── lib/                 # Shared utilities
│   ├── retry.ts         # Exponential backoff with abort support
│   └── micCheck.ts      # Browser mic/MediaRecorder detection
├── db/                  # IndexedDB layer (Dexie.js)
│   ├── sessions/        # Session CRUD operations
│   ├── apiKey/          # API key storage
│   └── seed/            # Mock data for development
├── constants/           # App-wide constants (no magic values)
│   ├── openai.ts        # Model IDs, timeouts, system prompts
│   ├── feedback.ts      # Feedback model config + prompt
│   ├── interview.ts     # Retry config, TTS fallback timing
│   ├── session.ts       # Recording limits, warning thresholds
│   ├── topics.ts        # Topic list + labels
│   └── copy.ts          # User-facing strings
└── test/                # Test utilities + factories
    ├── factories.ts     # Session/question factory helpers
    ├── renderWithProviders.tsx
    └── msw/             # Mock Service Worker handlers
```

## Error Handling

- **Invalid API key (401):** prompts user to update key in Settings
- **Quota exhausted (429 — billing):** links to OpenAI billing page
- **Rate limited (429 — rate):** automatic retry with exponential backoff (max 3 attempts)
- **Network failure:** inline error with retry button
- **Request timeout:** per-call timeouts (STT: 30s, LLM: 20s, TTS: 15s)
- **TTS failure:** falls back to displaying question as text

## Audio & Microphone

- Browser compatibility check (MediaRecorder API) before session start
- Mic device detection and permission gating
- Max recording duration: 4 minutes per answer (with 30s warning)
- Supported formats: WebM/Opus (Chrome/Firefox), MP4/AAC (Safari)
- All in-flight API calls cancelled via AbortController on navigation/stop

## Accessibility

- WCAG 2.1 AA compliant
- `eslint-plugin-jsx-a11y` enforced
- Skip-to-content link, proper landmarks, ARIA labels, focus management
- `prefers-reduced-motion` respected for all animations
- `aria-live` regions for recording state, transcription status, and session progress
- Lighthouse accessibility target: 100
