import type { ConversationTurn, OpenAIServiceError } from '@/services/types';

export type InterviewState =
  | 'idle'
  | 'ai_speaking'
  | 'user_recording'
  | 'transcribing'
  | 'skipping'
  | 'generating'
  | 'generating_feedback'
  | 'completed'
  | 'error';

export interface InterviewSessionState {
  status: InterviewState;
  topic: string;
  topicLabel: string;
  targetQuestionCount: number;
  currentQuestionIndex: number;
  currentQuestion: string | null;
  history: ConversationTurn[];
  error: OpenAIServiceError | null;
  /** Shown when TTS fails — the question text as fallback */
  ttsFallbackText: string | null;
  startedAt: number | null;
  isPartial: boolean;
  sessionId: string | null;
  /** The status to retry from when RETRY is dispatched */
  retryFromStatus: InterviewState | null;
  /** Number of in-flight background transcriptions */
  pendingTranscriptions: number;
  candidateName: string;
}

export type InterviewAction =
  | {
      type: 'START';
      topic: string;
      topicLabel: string;
      questionCount: number;
      candidateName?: string;
    }
  | { type: 'QUESTION_READY'; question: string }
  | { type: 'TTS_DONE' }
  | { type: 'TTS_FAILED'; question: string }
  | { type: 'TRANSCRIBING' }
  | { type: 'RECORDING_DONE'; transcript: string }
  | { type: 'ANSWER_RECORDED' }
  | { type: 'TRANSCRIPT_READY'; questionIndex: number; transcript: string }
  | { type: 'FEEDBACK_DONE'; sessionId: string }
  | { type: 'ERROR'; error: OpenAIServiceError; failedStatus: InterviewState }
  | { type: 'RETRY' }
  | { type: 'STOP' }
  | { type: 'SKIP_NO_RESPONSE' }
  | { type: 'SKIP_DONE' };

export interface InterviewConfig {
  topic: string;
  topicLabel: string;
  questionCount: number;
  candidateName?: string;
}
