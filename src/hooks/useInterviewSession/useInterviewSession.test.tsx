import { expect, test, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { platform, SECRET_OPENAI_API_KEY } from '@/platform';

// --- Dynamic audioRecorder mock ---
import type { MicError } from '@/lib/micError';

const recorderState = {
  audioBlob: null as Blob | null,
  isRecording: false,
  error: null as MicError | null,
};
const recorderFns = {
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  clearBlob: vi.fn(),
};

vi.mock('@/hooks/useAudioRecorder/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    ...recorderFns,
    get audioBlob() {
      return recorderState.audioBlob;
    },
    get isRecording() {
      return recorderState.isRecording;
    },
    get error() {
      return recorderState.error;
    },
  }),
}));

vi.mock('@/services/llm/llm', () => ({
  generateNextQuestion: vi.fn().mockResolvedValue('What is a closure?'),
}));
vi.mock('@/services/tts/tts', () => ({
  speakText: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/stt/stt', () => ({
  transcribeAudio: vi.fn().mockResolvedValue('A closure captures variables.'),
}));
vi.mock('@/services/feedback/feedback', () => ({
  generateFeedback: vi.fn().mockResolvedValue({
    questions: [{ rating: 8, feedback: 'Good.', confidence: 'high', modelAnswer: 'Model.' }],
    summary: 'Well done.',
  }),
}));
const createSession = vi.fn().mockResolvedValue(undefined);
vi.spyOn(platform.storage.sessions, 'create').mockImplementation(createSession);

const { useInterviewSession } = await import('./useInterviewSession');
const { generateNextQuestion } = await import('@/services/llm/llm');
const { speakText } = await import('@/services/tts/tts');
const { transcribeAudio } = await import('@/services/stt/stt');
const { generateFeedback } = await import('@/services/feedback/feedback');

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(async () => {
  await platform.storage.secrets.set(SECRET_OPENAI_API_KEY, 'sk-test');
  recorderState.audioBlob = null;
  recorderState.isRecording = false;
  recorderState.error = null;
  recorderFns.startRecording.mockClear();
  recorderFns.stopRecording.mockClear();
  recorderFns.clearBlob.mockClear();
  vi.mocked(generateNextQuestion).mockReset().mockResolvedValue('What is a closure?');
  vi.mocked(speakText).mockReset().mockResolvedValue(undefined);
  vi.mocked(transcribeAudio).mockReset().mockResolvedValue('A closure captures variables.');
  vi.mocked(generateFeedback)
    .mockReset()
    .mockResolvedValue({
      questions: [{ rating: 8, feedback: 'Good.', confidence: 'high', modelAnswer: 'Model.' }],
      summary: 'Well done.',
    });
  createSession.mockReset().mockResolvedValue(undefined);
});

test('full single-question interview: idle → generate → speak → record → feedback → completed', async () => {
  const { result, rerender } = renderHook(() => useInterviewSession(), { wrapper });
  expect(result.current.state.status).toBe('idle');

  // Start session with 1 question
  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 });
  });
  expect(result.current.state.topic).toBe('react-nextjs');

  // Generating → ai_speaking → user_recording
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));
  expect(result.current.state.currentQuestion).toBe('What is a closure?');
  expect(result.current.state.currentQuestionIndex).toBe(1);

  // Simulate audioBlob ready → triggers ANSWER_RECORDED + background transcription
  recorderState.audioBlob = new Blob([new Uint8Array(6000)], { type: 'audio/webm' });
  rerender();

  expect(recorderFns.clearBlob).toHaveBeenCalled();

  // Transcription completes in background, then feedback generates
  await waitFor(() =>
    expect(result.current.state.history[0]?.answer).toBe('A closure captures variables.'),
  );

  // Feedback generates, session is saved, status → completed
  await waitFor(() => expect(result.current.state.status).toBe('completed'));
  expect(result.current.state.sessionId).toBeTruthy();
  expect(createSession).toHaveBeenCalledOnce();
});

test('TTS failure sets ttsFallbackText and still reaches user_recording', async () => {
  vi.mocked(speakText).mockRejectedValue(new Error('TTS unavailable'));

  const { result } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 });
  });

  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));
  expect(result.current.state.ttsFallbackText).toBe('What is a closure?');
});

test('non-retryable transcription failure falls back to placeholder immediately', async () => {
  vi.mocked(transcribeAudio).mockRejectedValue(new Error('STT down'));

  const { result, rerender } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 });
  });
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  recorderState.audioBlob = new Blob([new Uint8Array(6000)], { type: 'audio/webm' });
  rerender();

  await waitFor(() => expect(result.current.state.pendingTranscriptions).toBe(0));
  expect(result.current.state.history[0].answer).toBe('[transcription failed]');
  // Non-retryable error → only one attempt, no retries
  expect(transcribeAudio).toHaveBeenCalledTimes(1);
});

test('transcription retries on transient error and succeeds on second attempt', async () => {
  vi.mocked(transcribeAudio)
    .mockRejectedValueOnce({ type: 'timeout', message: 'Timed out.', retryable: true })
    .mockResolvedValueOnce('A closure captures variables.');

  const { result, rerender } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 });
  });
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  recorderState.audioBlob = new Blob([new Uint8Array(6000)], { type: 'audio/webm' });
  rerender();

  // First attempt fails (timeout, retryable) — retry delay is real setTimeout.
  // waitFor polls frequently enough to catch the state update after the 1s retry delay.
  await waitFor(
    () => expect(result.current.state.history[0]?.answer).toBe('A closure captures variables.'),
    { timeout: 5000 },
  );
  expect(transcribeAudio).toHaveBeenCalledTimes(2);
});

test('small audio blob skips STT and transitions through skipping state', async () => {
  const { result, rerender } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 3 });
  });
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  // Simulate a tiny blob (silence-only) — below MIN_BLOB_SIZE threshold
  recorderState.audioBlob = new Blob([new Uint8Array(100)], { type: 'audio/webm' });
  rerender();

  // Should transition to skipping (no STT call made)
  await waitFor(() => expect(result.current.state.status).toBe('skipping'));
  expect(result.current.state.history[0].answer).toBe('[no response]');
  expect(transcribeAudio).not.toHaveBeenCalled();
});

test('stop with no answers transitions to completed with isPartial', () => {
  const { result } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => result.current.start({ topic: 'nodejs', topicLabel: 'Node.js', questionCount: 3 }));
  act(() => result.current.stop());

  expect(result.current.state.status).toBe('completed');
  expect(result.current.state.isPartial).toBe(true);
});

test('stop while recording calls recorder.stopRecording', async () => {
  const { result } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 3 }));
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  recorderState.isRecording = true;
  act(() => result.current.stop());

  expect(recorderFns.stopRecording).toHaveBeenCalled();
  expect(result.current.state.status).toBe('completed');
});

test('stop after answering a question generates feedback and completes', async () => {
  const { result, rerender } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 3 });
  });
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  // Answer one question
  recorderState.audioBlob = new Blob([new Uint8Array(6000)], { type: 'audio/webm' });
  rerender();

  // Wait for next question cycle (Q2 generating → ai_speaking → user_recording)
  await waitFor(() => expect(result.current.state.currentQuestionIndex).toBe(2));
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  // Stop early — should trigger feedback generation (not hang)
  act(() => result.current.stop());

  expect(result.current.state.status).toBe('generating_feedback');
  expect(result.current.state.isPartial).toBe(true);

  await waitFor(() => expect(result.current.state.status).toBe('completed'));
  expect(result.current.state.sessionId).toBeTruthy();
  expect(generateFeedback).toHaveBeenCalled();
});

test('retry after error re-enters the failed status and resumes', async () => {
  vi.mocked(generateNextQuestion).mockRejectedValueOnce({
    type: 'network',
    message: 'offline',
    retryable: false,
  });

  const { result } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 }));

  await waitFor(() => expect(result.current.state.status).toBe('error'));
  expect(result.current.state.error?.type).toBe('network');

  vi.mocked(generateNextQuestion).mockResolvedValueOnce('Retry question');

  act(() => result.current.retry());

  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));
  expect(result.current.state.currentQuestion).toBe('Retry question');
});

test('recorder error surfaces into session error state', async () => {
  const { result, rerender } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 }));
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  // Simulate recorder error while in user_recording
  recorderState.error = { kind: 'disconnected', message: 'Microphone disconnected' };
  rerender();

  await waitFor(() => expect(result.current.state.status).toBe('error'));
  expect(result.current.state.error?.message).toBe('Microphone disconnected');
});

test('stopRecordingOnly delegates to recorder.stopRecording', async () => {
  const { result } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 }));
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  recorderState.isRecording = true;
  act(() => result.current.stopRecordingOnly());

  expect(recorderFns.stopRecording).toHaveBeenCalled();
});

test('feedback generation error transitions to error state', async () => {
  vi.mocked(generateFeedback).mockRejectedValue({
    type: 'network',
    message: 'feedback failed',
    retryable: false,
  });

  const { result, rerender } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 });
  });
  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));

  recorderState.audioBlob = new Blob([new Uint8Array(6000)], { type: 'audio/webm' });
  rerender();

  await waitFor(() => expect(result.current.state.status).toBe('error'));
  expect(result.current.state.error?.message).toBe('feedback failed');
  expect(result.current.state.retryFromStatus).toBe('generating_feedback');
});
