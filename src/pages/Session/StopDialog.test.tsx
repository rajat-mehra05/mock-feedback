import { beforeEach, expect, test, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Session } from './Session';
import { initialState } from '@/hooks/useInterviewSession/reducer';
import type { InterviewSessionState } from '@/hooks/useInterviewSession/types';

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const stopFn = vi.fn();
const startFn = vi.fn();
const retryFn = vi.fn();
const stopRecordingOnlyFn = vi.fn();

vi.mock('@/hooks/useInterviewSession/useInterviewSession', () => ({
  useInterviewSession: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('./MicCheckGate', () => ({
  MicCheckGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useInterviewSession } from '@/hooks/useInterviewSession/useInterviewSession';
import { trackEvent } from '@/lib/analytics';

beforeEach(() => {
  vi.clearAllMocks();
});

function mockSessionState(overrides: Partial<InterviewSessionState> = {}) {
  vi.mocked(useInterviewSession).mockReturnValue({
    state: { ...initialState, ...overrides },
    start: startFn,
    stop: stopFn,
    retry: retryFn,
    stopRecordingOnly: stopRecordingOnlyFn,
  });
}

test('stop button with 0 answers shows leave dialog, cancel keeps interview, leave navigates to history', async () => {
  mockSessionState({
    status: 'ai_speaking',
    currentQuestion: 'What is React?',
    history: [],
    targetQuestionCount: 5,
  });
  const user = userEvent.setup();

  renderWithProviders(<Session />, { initialRoute: '/session?topic=react-nextjs&count=5' });

  // Click stop button to open dialog
  await user.click(screen.getByRole('button', { name: /stop interview/i }));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/leave interview\?/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/no feedback will be generated/i)).toBeInTheDocument();

  // Cancel closes dialog without side effects
  await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(stopFn).not.toHaveBeenCalled();

  // Re-open and click Leave
  await user.click(screen.getByRole('button', { name: /stop interview/i }));
  const reopened = await screen.findByRole('dialog');
  await user.click(within(reopened).getByRole('button', { name: /leave/i }));

  expect(stopFn).not.toHaveBeenCalled();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  expect(trackEvent).toHaveBeenCalledWith(
    'interview_abandoned',
    expect.objectContaining({ topic: expect.any(String) }),
  );
});

test('stop button with 1+ answers shows end-early dialog, cancel keeps interview, confirm calls stop()', async () => {
  mockSessionState({
    status: 'user_recording',
    currentQuestion: 'What is a hook?',
    history: [
      { question: 'What is React?', answer: 'A UI library.' },
      { question: 'Explain JSX.', answer: 'Syntax extension.' },
    ],
    targetQuestionCount: 7,
  });
  const user = userEvent.setup();

  renderWithProviders(<Session />, { initialRoute: '/session?topic=react-nextjs&count=7' });

  await user.click(screen.getByRole('button', { name: /stop interview/i }));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/end interview early\?/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/2 of 7/i)).toBeInTheDocument();

  // Cancel
  await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(stopFn).not.toHaveBeenCalled();

  // Re-open and confirm
  await user.click(screen.getByRole('button', { name: /stop interview/i }));
  const reopened = await screen.findByRole('dialog');
  await user.click(within(reopened).getByRole('button', { name: /end & get feedback/i }));

  expect(stopFn).toHaveBeenCalledOnce();
  expect(trackEvent).not.toHaveBeenCalledWith('interview_abandoned', expect.anything());
});
