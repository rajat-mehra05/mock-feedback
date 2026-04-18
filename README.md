# VoiceRound

AI-powered mock interviewer that helps developers practice technical interviews. The AI asks questions via voice, you answer verbally and you get detailed feedback with ratings.

![VoiceRound home screen](public/home.png)

## Why I Built This

I wanted to get better at explaining technical concepts out loud, the way you have to in real interviews. This app lets me practice that and get honest feedback on both my answers and how I communicate them.

Most mock interview tools I found were paid and I couldn't customize them to focus on what I actually needed to work on. So I made this open source. You can tweak the prompts, add your own topics or change how feedback works. Make it yours.

## Tech Stack

- **Frontend:** Vite 8 + React 19 + TypeScript 5.9
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **AI / Voice:** OpenAI (GPT-4o mini for LLM + STT, gpt-4o-mini-tts for TTS)
- **Storage:** IndexedDB (Dexie.js) — fully local, no backend
- **Testing:** Vitest + React Testing Library + MSW
- **CI:** GitHub Actions (lint + format + unit tests + build)
- **Quality:** Lighthouse CI (performance + accessibility)
- **Pre-commit:** Husky + lint-staged
- **Analytics:** Vercel Analytics

## BYOK (Bring Your Own Key)

This app requires your own OpenAI API key. Your key is stored in IndexedDB on your device and is only sent to OpenAI directly from the browser. No keys are shipped, hardcoded or proxied.

## How It Works

1. Click **Start** → enter your OpenAI API key (first time only), select a topic and question count (5, 7, or 10)
2. Grant microphone access when prompted
3. AI asks questions via text-to-speech
4. You answer verbally — mic records and auto-detects when you stop speaking
5. After all questions, AI generates structured feedback (rating + confidence level + commentary per question + overall summary)
6. Feedback saved to IndexedDB, viewable anytime from History

## Architecture

```mermaid
graph TB
    subgraph Pages["Pages (React Router v7)"]
        Home["/  Home"]
        StartModal["StartModal<br/>(topic + name + API key)"]
        Session["/session  Interview"]
        History["/history  History"]
        Feedback["/history/:id  Feedback"]
    end

    subgraph Hooks["Core Hooks"]
        useInterview["useInterviewSession<br/>(state machine + orchestrator)"]
        useAudio["useAudioRecorder<br/>(Web Audio API + silence detection)"]
        useApiKeyHook["ApiKeyProvider<br/>(React Context)"]
    end

    subgraph Services["Services (OpenAI SDK)"]
        OpenAIClient["OpenAI Client Factory<br/>(cached instance)"]
        LLM["LLM<br/>GPT-4o mini"]
        STT["STT<br/>gpt-4o-mini-transcribe"]
        TTS["TTS<br/>gpt-4o-mini-tts"]
        FeedbackSvc["Feedback<br/>GPT-4o mini"]
    end

    subgraph Storage["Storage (IndexedDB via Dexie)"]
        SessionsDB[("Sessions DB<br/>interviews + scores")]
        KeyDB[("API Key DB<br/>OpenAI key")]
        PrefsDB[("Preferences DB<br/>candidate name")]
    end

    subgraph Browser["Browser APIs"]
        Mic["MediaRecorder"]
        AudioCtx["AudioContext<br/>AnalyserNode (RMS)"]
        AudioPlay["AudioContext<br/>Playback"]
    end

    Home --> StartModal
    StartModal -->|"load/save name"| PrefsDB
    StartModal -->|"start interview"| Session
    Session --> useInterview
    useInterview --> LLM
    useInterview --> useAudio
    useInterview -->|"question text"| TTS
    useInterview -->|"audio blob"| STT
    useInterview -->|"all Q&A pairs"| FeedbackSvc
    useInterview -->|"save session"| SessionsDB
    useInterview -->|"navigate on complete"| Feedback

    useAudio --> Mic
    useAudio --> AudioCtx
    TTS --> AudioPlay

    LLM --> OpenAIClient
    STT --> OpenAIClient
    TTS --> OpenAIClient
    FeedbackSvc --> OpenAIClient
    OpenAIClient -->|"reads key"| KeyDB
    useApiKeyHook -->|"read/write key"| KeyDB

    History -->|"load sessions"| SessionsDB
    Feedback -->|"load session"| SessionsDB
```

### Interview Flow (State Machine)

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> generating : START
    generating --> ai_speaking : QUESTION_READY
    ai_speaking --> user_recording : TTS_DONE
    user_recording --> awaiting_transcript : ANSWER_RECORDED
    awaiting_transcript --> generating : TRANSCRIPT_READY (more questions)
    awaiting_transcript --> generating_feedback : TRANSCRIPT_READY (all done)
    ai_speaking --> user_recording : TTS_FAILED (fallback to text)
    user_recording --> skipping : SKIP_NO_RESPONSE (silence)
    skipping --> generating : next question
    skipping --> generating_feedback : last question
    generating_feedback --> completed : FEEDBACK_DONE
    completed --> [*]

    generating --> generating_feedback : STOP (early)
    ai_speaking --> generating_feedback : STOP (early)
    user_recording --> generating_feedback : STOP (early)
    awaiting_transcript --> generating_feedback : STOP (early)

    generating --> error : ERROR
    ai_speaking --> error : ERROR
    user_recording --> error : ERROR
    awaiting_transcript --> error : ERROR
    generating_feedback --> error : ERROR
    error --> generating : RETRY
    error --> ai_speaking : RETRY
    error --> generating_feedback : RETRY
```

### Data Flow

```text
User clicks Start
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  INTERVIEW LOOP (repeats per question)                          │
│                                                                 │
│  1. LLM generates question (GPT-4o mini + conversation history) │
│  2. TTS speaks question aloud (gpt-4o-mini-tts → AudioContext)  │
│  3. User answers verbally (MediaRecorder + silence detection)   │
│  4. STT transcribes answer (gpt-4o-mini-transcribe)             │
│     └─ waits for transcript before generating next question     │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
Feedback generation (GPT-4o mini)
    → per-question: rating, confidence, commentary, model answer
    → overall summary
    │
    ▼
Session saved to IndexedDB → navigate to Feedback page
```

## Interview Topics

15 topics across 4 groups:

- **Languages & Runtimes (5):** JavaScript & TypeScript, Python, Go, Java, Rust
- **Frameworks (3):** React & Next.js, Node.js, FastAPI & Django
- **Concepts (6):** System Design (Frontend), System Design (Backend), System Design (Full-Stack), Docker & Kubernetes, AWS & Cloud, GraphQL
- **Behavioral (1):** Behavioral & STAR

## Getting Started

```bash
npm install
npm run dev
```

## Error Handling

- **Invalid API key (401):** prompts user to update key in Settings
- **Quota exhausted (429 — billing):** links to OpenAI billing page
- **Rate limited (429 — rate):** automatic retry with exponential backoff (max 3 attempts)
- **Network failure:** inline error with retry button
- **Request timeout:** per-call timeouts (STT: 60s, LLM: 20s, TTS: 30s, Feedback: 45s)
- **TTS failure:** falls back to displaying question as text

## Audio & Microphone

- Browser compatibility check (MediaRecorder API) before session start
- Mic device detection and permission gating
- Native silence detection via Web Audio API `AnalyserNode` (RMS amplitude) — auto-stops recording after 6 seconds of silence
- Max recording duration: 4 minutes per answer (with 30s warning)
- Transcription runs in the background — next question generates after transcript is ready
- Supported formats: WebM/Opus (Chrome/Firefox), MP4/AAC (Safari)
- All in-flight API calls cancelled via AbortController on navigation/stop

## Accessibility

Accessibility has been a priority from the start. The app is designed to meet WCAG 2.1 AA standards — all interactive elements are fully keyboard-navigable and screen readers are kept informed of recording and session state changes.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request — whether it's a bug fix, a new feature idea, or just a suggestion to improve the experience. All input is appreciated.
