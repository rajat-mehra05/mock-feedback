import type { InterviewSessionState, InterviewAction } from './types';

export const initialState: InterviewSessionState = {
  status: 'idle',
  topic: '',
  topicLabel: '',
  targetQuestionCount: 0,
  currentQuestionIndex: 0,
  currentQuestion: null,
  history: [],
  error: null,
  ttsFallbackText: null,
  startedAt: null,
  isPartial: false,
  sessionId: null,
  retryFromStatus: null,
  pendingTranscriptions: 0,
  candidateName: '',
};

export function interviewReducer(
  state: InterviewSessionState,
  action: InterviewAction,
): InterviewSessionState {
  switch (action.type) {
    case 'START':
      return {
        ...initialState,
        status: 'generating',
        topic: action.topic,
        topicLabel: action.topicLabel,
        targetQuestionCount: action.questionCount,
        startedAt: Date.now(),
        candidateName: action.candidateName ?? '',
      };

    case 'QUESTION_READY': {
      const adjustedHistory = action.isRepeat ? state.history.slice(0, -1) : state.history;
      // Only cancel the pending transcription if the discarded turn still has an empty
      // placeholder answer — if TRANSCRIPT_READY already backfilled it, it already decremented.
      const discardedTurnStillPending =
        action.isRepeat &&
        state.history.length > 0 &&
        state.history[state.history.length - 1].answer === '';
      const adjustedPending = discardedTurnStillPending
        ? state.pendingTranscriptions - 1
        : state.pendingTranscriptions;
      const effectiveCount = adjustedHistory.length;
      // If this isn't a repeat and we've already reached the target, finalize
      if (!action.isRepeat && effectiveCount >= state.targetQuestionCount) {
        return {
          ...state,
          status: 'generating_feedback',
          history: adjustedHistory,
          currentQuestion: null,
          ttsFallbackText: null,
          pendingTranscriptions: adjustedPending,
        };
      }
      return {
        ...state,
        status: 'ai_speaking',
        currentQuestion: action.question,
        currentQuestionIndex: action.isRepeat
          ? state.currentQuestionIndex
          : state.currentQuestionIndex + 1,
        history: adjustedHistory,
        pendingTranscriptions: adjustedPending,
        ttsFallbackText: null,
      };
    }

    case 'TTS_DONE':
      return { ...state, status: 'user_recording', ttsFallbackText: null };

    case 'TTS_FAILED':
      return {
        ...state,
        status: 'user_recording',
        ttsFallbackText: action.question,
      };

    case 'TRANSCRIBING':
      return { ...state, status: 'transcribing' };

    case 'RECORDING_DONE': {
      const newHistory = [
        ...state.history,
        { question: state.currentQuestion!, answer: action.transcript },
      ];
      return {
        ...state,
        status: 'generating',
        history: newHistory,
        currentQuestion: null,
      };
    }

    case 'ANSWER_RECORDED': {
      const newHistory = [...state.history, { question: state.currentQuestion!, answer: '' }];
      return {
        ...state,
        status: 'generating',
        history: newHistory,
        currentQuestion: null,
        pendingTranscriptions: state.pendingTranscriptions + 1,
      };
    }

    case 'TRANSCRIPT_READY': {
      // Ignore stale transcriptions for turns that were discarded (e.g. repeat questions)
      if (action.questionIndex >= state.history.length) {
        return state;
      }
      const updatedHistory = state.history.map((turn, i) =>
        i === action.questionIndex ? { ...turn, answer: action.transcript } : turn,
      );
      return {
        ...state,
        history: updatedHistory,
        pendingTranscriptions: state.pendingTranscriptions - 1,
      };
    }

    case 'FEEDBACK_DONE':
      return {
        ...state,
        status: 'completed',
        sessionId: action.sessionId,
      };

    case 'ERROR':
      return {
        ...state,
        status: 'error',
        error: action.error,
        retryFromStatus: action.failedStatus,
      };

    case 'RETRY':
      return {
        ...state,
        status: state.retryFromStatus ?? 'generating',
        error: null,
        retryFromStatus: null,
      };

    case 'STOP': {
      if (state.history.length > 0) {
        // Reset pendingTranscriptions — in-flight transcriptions are aborted by stop()
        // and will never dispatch TRANSCRIPT_READY, so we clear the counter to unblock feedback.
        return {
          ...state,
          status: 'generating_feedback',
          isPartial: true,
          pendingTranscriptions: 0,
        };
      }
      return { ...state, status: 'completed', isPartial: true };
    }

    case 'SKIP_NO_RESPONSE': {
      const newHistory = [
        ...state.history,
        { question: state.currentQuestion!, answer: '[no response]' },
      ];
      return {
        ...state,
        status: 'skipping',
        history: newHistory,
        currentQuestion: null,
      };
    }

    case 'SKIP_DONE': {
      const isLast = state.history.length >= state.targetQuestionCount;
      return {
        ...state,
        status: isLast ? 'generating_feedback' : 'generating',
      };
    }

    default:
      return state;
  }
}
