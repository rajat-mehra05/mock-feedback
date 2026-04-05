export interface ConversationTurn {
  question: string;
  answer: string;
}

export type OpenAIErrorType =
  | 'auth'
  | 'quota'
  | 'rate_limit'
  | 'not_found'
  | 'network'
  | 'timeout'
  | 'unknown';

export interface OpenAIServiceError {
  type: OpenAIErrorType;
  message: string;
  status?: number;
  retryable: boolean;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface QuestionFeedback {
  rating: number;
  feedback: string;
  confidence: ConfidenceLevel;
  modelAnswer: string;
}

export interface FeedbackResult {
  questions: QuestionFeedback[];
  summary: string;
}
