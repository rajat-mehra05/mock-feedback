# Mock Feedback

AI-powered mock interviewer that helps developers practice technical interviews. The AI asks questions via voice, you answer verbally, and you get detailed feedback with ratings — all calibrated to your target seniority level.

## Tech Stack

- **Frontend:** Vite 8 + React 19 + TypeScript 5.9
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **AI / Voice:** OpenAI (GPT-4o Mini for LLM + STT, gpt-4o-mini-tts for TTS)
- **Storage:** IndexedDB (Dexie.js) — fully local, no backend
- **Testing:** Vitest + React Testing Library + MSW
- **CI:** GitHub Actions (lint + format + unit tests + build)
- **Pre-commit:** Husky + lint-staged

## BYOK (Bring Your Own Key)

This app requires your own OpenAI API key. Your key is stored in IndexedDB on your device and is only sent to OpenAI directly from the browser. No keys are shipped, hardcoded, or proxied.

## How It Works

1. Click **Start** → enter your OpenAI API key (first time only), select a topic, target role level, and question count
2. AI asks questions via text-to-speech, calibrated to your chosen level
3. You answer verbally — mic records, auto-detects when you stop speaking
4. After all questions, AI generates structured feedback (rating + commentary per question + overall summary)
5. Feedback saved to IndexedDB, viewable anytime from History

## Interview Topics

- JavaScript / TypeScript
- React & Next.js
- Node.js
- Behavioral / STAR

## Target Role Levels

Questions, follow-ups, and feedback scoring are calibrated to the selected level:

| Level         | Focus                                                                |
| ------------- | -------------------------------------------------------------------- |
| **Junior**    | Fundamentals, definitions, basic usage patterns                      |
| **Mid-Level** | Practical experience, trade-off awareness, "how would you" questions |
| **Senior**    | Deep understanding, architectural thinking, edge case identification |
| **Staff**     | Cross-domain expertise, technical leadership, decisions at scale     |

## Interview Style

| Style      | Behavior                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Normal** | Supportive and professional. Moves on after a weak answer.                                                                                                                                              |
| **Brutal** | Pushes back on shallow or vague answers — asks you to go deeper, explain internals, or justify trade-offs. Does not grill unprovoked; only escalates when depth is lacking for the selected role level. |

## Scoring

Each answer is rated 1–10 by GPT-4o Mini against the selected role level. A basic answer scores higher in a Junior session than in a Staff session.

| Score | Tier                    |
| ----- | ----------------------- |
| 8–10  | Excellent (green)       |
| 6–7.9 | Satisfactory (yellow)   |
| < 6   | Needs improvement (red) |

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `npm run dev`           | Start Vite dev server               |
| `npm run build`         | TypeScript check + production build |
| `npm run lint`          | ESLint check                        |
| `npm run format:check`  | Prettier check                      |
| `npm run test`          | Run Vitest unit/component tests     |
| `npm run test:watch`    | Vitest in watch mode                |
| `npm run test:coverage` | Vitest with coverage report         |
| `npm run lighthouse`    | Run Lighthouse CI locally           |

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
- Native silence detection via Web Audio API `AnalyserNode` (RMS amplitude) — auto-stops recording after 6 seconds of silence
- Max recording duration: 4 minutes per answer (with 30s warning)
- Transcription runs in the background — no "transcribing..." wait between questions
- Supported formats: WebM/Opus (Chrome/Firefox), MP4/AAC (Safari)
- All in-flight API calls cancelled via AbortController on navigation/stop

## Accessibility

Accessibility has been a priority from the start. The app is designed to meet WCAG 2.1 AA standards — all interactive elements are fully keyboard-navigable, screen readers are kept informed of recording and session state changes, and animations respect the user's `prefers-reduced-motion` preference.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request — whether it's a bug fix, a new feature idea, or just a suggestion to improve the experience. All input is appreciated.
