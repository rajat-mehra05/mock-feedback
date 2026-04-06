import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIndicator } from './StatusIndicator';

test('StatusIndicator renders the correct status label per state, recording rules when recording, and nothing for idle', () => {
  // idle — renders nothing
  const r1 = render(<StatusIndicator status="idle" questionIndex={0} />);
  expect(screen.queryByRole('status')).toBeNull();
  r1.unmount();

  // ai_speaking — pulsing indicator
  const r2 = render(<StatusIndicator status="ai_speaking" questionIndex={1} />);
  expect(screen.getByText(/ai is speaking/i)).toBeInTheDocument();
  r2.unmount();

  // user_recording — shows recording rules
  const r3 = render(<StatusIndicator status="user_recording" questionIndex={1} />);
  expect(screen.getByText(/recording your answer/i)).toBeInTheDocument();
  expect(screen.getByText(/max answer length/i)).toBeInTheDocument();
  r3.unmount();

  // skipping — no response detected
  const r4 = render(<StatusIndicator status="skipping" questionIndex={1} />);
  expect(screen.getByText(/no response detected/i)).toBeInTheDocument();
  r4.unmount();

  // awaiting_transcript — processing answer
  const r5pre = render(<StatusIndicator status="awaiting_transcript" questionIndex={1} />);
  expect(screen.getByText(/processing your answer/i)).toBeInTheDocument();
  r5pre.unmount();

  // generating — first question vs next question
  const r5a = render(<StatusIndicator status="generating" questionIndex={0} />);
  expect(screen.getByText(/generating first question/i)).toBeInTheDocument();
  r5a.unmount();

  const r5b = render(<StatusIndicator status="generating" questionIndex={1} />);
  expect(screen.getByText(/generating next question/i)).toBeInTheDocument();
  r5b.unmount();

  // generating_feedback — descriptive label with spinner
  const r6 = render(<StatusIndicator status="generating_feedback" questionIndex={1} />);
  expect(screen.getByText(/generating your session feedback/i)).toBeInTheDocument();
  r6.unmount();

  // completed normally — no spinner
  const r7 = render(<StatusIndicator status="completed" questionIndex={3} />);
  expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  r7.unmount();

  // completed with isPartial — session ended early
  const r8 = render(<StatusIndicator status="completed" questionIndex={1} isPartial />);
  expect(screen.getByText(/session ended early/i)).toBeInTheDocument();
  r8.unmount();
});
