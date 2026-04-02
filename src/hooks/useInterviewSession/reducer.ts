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
      };

    case 'QUESTION_READY':
      return {
        ...state,
        status: 'ai_speaking',
        currentQuestion: action.question,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        ttsFallbackText: null,
      };

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
      const isLast = newHistory.length >= state.targetQuestionCount;
      return {
        ...state,
        status: isLast ? 'generating_feedback' : 'generating',
        history: newHistory,
        currentQuestion: null,
      };
    }

    case 'ANSWER_RECORDED': {
      const newHistory = [...state.history, { question: state.currentQuestion!, answer: '' }];
      const isLast = newHistory.length >= state.targetQuestionCount;
      return {
        ...state,
        status: isLast ? 'generating_feedback' : 'generating',
        history: newHistory,
        currentQuestion: null,
        pendingTranscriptions: state.pendingTranscriptions + 1,
      };
    }

    case 'TRANSCRIPT_READY': {
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
        return { ...state, status: 'generating_feedback', isPartial: true };
      }
      return { ...state, status: 'completed', isPartial: true };
    }

    default:
      return state;
  }
}
