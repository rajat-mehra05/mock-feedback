import { expect, test, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { saveApiKey } from '@/db/apiKey/apiKey';

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
    questions: [{ rating: 8, feedback: 'Good.', modelAnswer: 'Model.' }],
    summary: 'Well done.',
  }),
}));
vi.mock('@/hooks/useAudioRecorder/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    clearBlob: vi.fn(),
    audioBlob: null,
    isRecording: false,
    error: null,
  }),
}));

const { useInterviewSession } = await import('./useInterviewSession');

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(async () => {
  await saveApiKey('sk-test');
  vi.mocked((await import('@/services/llm/llm')).generateNextQuestion)
    .mockReset()
    .mockResolvedValue('What is a closure?');
  vi.mocked((await import('@/services/tts/tts')).speakText)
    .mockReset()
    .mockResolvedValue(undefined);
  vi.mocked((await import('@/services/stt/stt')).transcribeAudio)
    .mockReset()
    .mockResolvedValue('A closure captures variables.');
  vi.mocked((await import('@/services/feedback/feedback')).generateFeedback)
    .mockReset()
    .mockResolvedValue({
      questions: [{ rating: 8, feedback: 'Good.', modelAnswer: 'Model.' }],
      summary: 'Well done.',
    });
});

test('hook starts in idle, generates a question, speaks it, and reaches user_recording', async () => {
  const { result } = renderHook(() => useInterviewSession(), { wrapper });
  expect(result.current.state.status).toBe('idle');

  act(() => {
    result.current.start({ topic: 'react-nextjs', topicLabel: 'React', questionCount: 1 });
  });
  expect(result.current.state.topic).toBe('react-nextjs');

  await waitFor(() => expect(result.current.state.status).toBe('user_recording'));
  expect(result.current.state.currentQuestion).toBe('What is a closure?');
  expect(result.current.state.currentQuestionIndex).toBe(1);
});

test('stop with no answers transitions to completed with isPartial', () => {
  const { result } = renderHook(() => useInterviewSession(), { wrapper });

  act(() => result.current.start({ topic: 'nodejs', topicLabel: 'Node.js', questionCount: 3 }));
  act(() => result.current.stop());

  expect(result.current.state.status).toBe('completed');
  expect(result.current.state.isPartial).toBe(true);
});

test('retry after error re-enters the failed status and resumes', async () => {
  const { generateNextQuestion } = await import('@/services/llm/llm');
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
