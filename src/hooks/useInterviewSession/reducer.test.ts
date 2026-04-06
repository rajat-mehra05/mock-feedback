import { expect, test } from 'vitest';
import { interviewReducer, initialState } from './reducer';
import type { InterviewSessionState } from './types';

test('interview reducer transitions through the complete happy path', () => {
  // START → generating
  let state = interviewReducer(initialState, {
    type: 'START',
    topic: 'react-nextjs',
    topicLabel: 'React & Next.js',
    questionCount: 2,
  });
  expect(state.status).toBe('generating');
  expect(state.topic).toBe('react-nextjs');
  expect(state.targetQuestionCount).toBe(2);
  expect(state.startedAt).toBeTypeOf('number');

  // QUESTION_READY → ai_speaking
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'What is JSX?',
  });
  expect(state.status).toBe('ai_speaking');
  expect(state.currentQuestion).toBe('What is JSX?');
  expect(state.currentQuestionIndex).toBe(1);

  // TTS_DONE → user_recording
  state = interviewReducer(state, { type: 'TTS_DONE' });
  expect(state.status).toBe('user_recording');

  // TRANSCRIBING → transcribing
  state = interviewReducer(state, { type: 'TRANSCRIBING' });
  expect(state.status).toBe('transcribing');

  // RECORDING_DONE (not last) → generating
  state = interviewReducer(state, {
    type: 'RECORDING_DONE',
    transcript: 'JSX is syntax extension',
  });
  expect(state.status).toBe('generating');
  expect(state.history).toHaveLength(1);
  expect(state.history[0].question).toBe('What is JSX?');
  expect(state.history[0].answer).toBe('JSX is syntax extension');

  // Second question cycle
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'Explain hooks',
  });
  state = interviewReducer(state, { type: 'TTS_DONE' });
  state = interviewReducer(state, { type: 'TRANSCRIBING' });

  // RECORDING_DONE (last question) → generating (finalization deferred to QUESTION_READY)
  state = interviewReducer(state, { type: 'RECORDING_DONE', transcript: 'Hooks are functions' });
  expect(state.status).toBe('generating');
  expect(state.history).toHaveLength(2);

  // QUESTION_READY with isRepeat: false finalizes when history >= targetQuestionCount
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'Unused next question',
  });
  expect(state.status).toBe('generating_feedback');

  // FEEDBACK_DONE → completed
  state = interviewReducer(state, { type: 'FEEDBACK_DONE', sessionId: 'session-123' });
  expect(state.status).toBe('completed');
  expect(state.sessionId).toBe('session-123');
});

test('TTS failure sets fallback text and continues to user_recording', () => {
  let state = interviewReducer(initialState, {
    type: 'START',
    topic: 'nodejs',
    topicLabel: 'Node.js',
    questionCount: 3,
  });
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'What is the event loop?',
  });
  expect(state.status).toBe('ai_speaking');

  state = interviewReducer(state, { type: 'TTS_FAILED', question: 'What is the event loop?' });
  expect(state.status).toBe('user_recording');
  expect(state.ttsFallbackText).toBe('What is the event loop?');
});

test('STOP mid-session with answers moves to generating_feedback and resets pendingTranscriptions', () => {
  const stateWithAnswers: InterviewSessionState = {
    ...initialState,
    status: 'user_recording',
    topic: 'javascript-typescript',
    topicLabel: 'JavaScript',
    targetQuestionCount: 5,
    currentQuestionIndex: 2,
    currentQuestion: 'Q3',
    history: [
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ],
    startedAt: Date.now(),
    pendingTranscriptions: 2,
  };

  const stopped = interviewReducer(stateWithAnswers, { type: 'STOP' });
  expect(stopped.status).toBe('generating_feedback');
  expect(stopped.isPartial).toBe(true);
  expect(stopped.pendingTranscriptions).toBe(0);
});

test('STOP with no answers completes immediately', () => {
  let state = interviewReducer(initialState, {
    type: 'START',
    topic: 'behavioral',
    topicLabel: 'Behavioral',
    questionCount: 3,
  });
  state = interviewReducer(state, { type: 'STOP' });
  expect(state.status).toBe('completed');
  expect(state.isPartial).toBe(true);
});

test('ANSWER_RECORDED waits for transcript before generating, TRANSCRIPT_READY unblocks LLM', () => {
  // Setup: get to user_recording with one question asked
  let state = interviewReducer(initialState, {
    type: 'START',
    topic: 'react-nextjs',
    topicLabel: 'React',
    questionCount: 2,
  });
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'What is React?',
  });
  state = interviewReducer(state, { type: 'TTS_DONE' });
  expect(state.status).toBe('user_recording');
  expect(state.pendingTranscriptions).toBe(0);

  // ANSWER_RECORDED — adds placeholder, increments pending, waits for transcript
  state = interviewReducer(state, { type: 'ANSWER_RECORDED' });
  expect(state.status).toBe('awaiting_transcript');
  expect(state.history).toHaveLength(1);
  expect(state.history[0].question).toBe('What is React?');
  expect(state.history[0].answer).toBe('');
  expect(state.pendingTranscriptions).toBe(1);
  expect(state.currentQuestion).toBeNull();

  // TRANSCRIPT_READY backfills answer and transitions to generating
  state = interviewReducer(state, {
    type: 'TRANSCRIPT_READY',
    questionIndex: 0,
    transcript: 'React is a UI library',
  });
  expect(state.history[0].answer).toBe('React is a UI library');
  expect(state.pendingTranscriptions).toBe(0);
  expect(state.status).toBe('generating');

  // Second question cycle
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'Explain hooks',
  });
  state = interviewReducer(state, { type: 'TTS_DONE' });

  // ANSWER_RECORDED for last question → awaiting_transcript
  state = interviewReducer(state, { type: 'ANSWER_RECORDED' });
  expect(state.status).toBe('awaiting_transcript');
  expect(state.history).toHaveLength(2);
  expect(state.history[1].answer).toBe('');
  expect(state.pendingTranscriptions).toBe(1);

  // Transcript arrives for second question → generating
  state = interviewReducer(state, {
    type: 'TRANSCRIPT_READY',
    questionIndex: 1,
    transcript: 'Hooks let you use state in functions',
  });
  expect(state.history[1].answer).toBe('Hooks let you use state in functions');
  expect(state.pendingTranscriptions).toBe(0);
  expect(state.status).toBe('generating');
});

test('TRANSCRIPT_READY backfills answer without changing status when not in awaiting_transcript', () => {
  // Build state: generating status with a pending transcription
  const state: InterviewSessionState = {
    ...initialState,
    status: 'generating',
    topic: 'react-nextjs',
    topicLabel: 'React',
    targetQuestionCount: 3,
    currentQuestionIndex: 1,
    history: [{ question: 'What is React?', answer: '' }],
    pendingTranscriptions: 1,
    startedAt: Date.now(),
  };

  const next = interviewReducer(state, {
    type: 'TRANSCRIPT_READY',
    questionIndex: 0,
    transcript: 'React is a UI library',
  });
  expect(next.history[0].answer).toBe('React is a UI library');
  expect(next.pendingTranscriptions).toBe(0);
  expect(next.status).toBe('generating'); // status unchanged

  // Same scenario but in error status
  const errorState: InterviewSessionState = {
    ...state,
    status: 'error',
    error: { type: 'network', message: 'offline', retryable: true },
    retryFromStatus: 'generating',
  };

  const nextError = interviewReducer(errorState, {
    type: 'TRANSCRIPT_READY',
    questionIndex: 0,
    transcript: 'React is a UI library',
  });
  expect(nextError.history[0].answer).toBe('React is a UI library');
  expect(nextError.pendingTranscriptions).toBe(0);
  expect(nextError.status).toBe('error'); // status unchanged
});

test('ERROR and RETRY cycle returns to the failed state', () => {
  let state = interviewReducer(initialState, {
    type: 'START',
    topic: 'react-nextjs',
    topicLabel: 'React',
    questionCount: 3,
  });

  // Error during generating
  state = interviewReducer(state, {
    type: 'ERROR',
    error: { type: 'rate_limit', message: 'Rate limited', retryable: true },
    failedStatus: 'generating',
  });
  expect(state.status).toBe('error');
  expect(state.error?.type).toBe('rate_limit');
  expect(state.retryFromStatus).toBe('generating');

  // Retry returns to generating
  state = interviewReducer(state, { type: 'RETRY' });
  expect(state.status).toBe('generating');
  expect(state.error).toBeNull();
  expect(state.retryFromStatus).toBeNull();
});

test('SKIP_NO_RESPONSE records [no response] and transitions through skipping → SKIP_DONE', () => {
  let state = interviewReducer(initialState, {
    type: 'START',
    topic: 'react-nextjs',
    topicLabel: 'React',
    questionCount: 3,
  });
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'What is React?',
  });
  state = interviewReducer(state, { type: 'TTS_DONE' });

  // SKIP_NO_RESPONSE → skipping with [no response] in history
  state = interviewReducer(state, { type: 'SKIP_NO_RESPONSE' });
  expect(state.status).toBe('skipping');
  expect(state.history).toHaveLength(1);
  expect(state.history[0].answer).toBe('[no response]');
  expect(state.currentQuestion).toBeNull();

  // SKIP_DONE (not last) → generating
  state = interviewReducer(state, { type: 'SKIP_DONE' });
  expect(state.status).toBe('generating');

  // Fast-forward to last question (Q2 skip would be identical to Q1)
  state = { ...state, history: [...state.history, { question: 'Q2', answer: '[no response]' }] };
  state = interviewReducer(state, { type: 'QUESTION_READY', isRepeat: false, question: 'Q3' });
  state = interviewReducer(state, { type: 'TTS_DONE' });
  state = interviewReducer(state, { type: 'SKIP_NO_RESPONSE' });

  // SKIP_DONE on last question → generating_feedback
  state = interviewReducer(state, { type: 'SKIP_DONE' });
  expect(state.status).toBe('generating_feedback');
});

test('QUESTION_READY with isRepeat keeps currentQuestionIndex unchanged and removes last history entry', () => {
  let state = interviewReducer(initialState, {
    type: 'START',
    topic: 'react-nextjs',
    topicLabel: 'React & Next.js',
    questionCount: 3,
  });
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: false,
    question: 'What is JSX?',
  });
  state = interviewReducer(state, { type: 'TTS_DONE' });
  // Simulate "wait" answer recorded
  state = interviewReducer(state, { type: 'RECORDING_DONE', transcript: 'Wait a moment' });
  expect(state.history).toHaveLength(1);
  expect(state.currentQuestionIndex).toBe(1);

  // QUESTION_READY with isRepeat: question and index stay the same, "wait" turn removed
  state = interviewReducer(state, {
    type: 'QUESTION_READY',
    isRepeat: true,
    question: 'What is JSX?',
  });
  expect(state.status).toBe('ai_speaking');
  expect(state.currentQuestion).toBe('What is JSX?');
  expect(state.currentQuestionIndex).toBe(1);
  expect(state.history).toHaveLength(0);
});

test('unknown action type returns state unchanged', () => {
  const state = interviewReducer(initialState, { type: 'BOGUS' } as never);
  expect(state).toBe(initialState);
});
