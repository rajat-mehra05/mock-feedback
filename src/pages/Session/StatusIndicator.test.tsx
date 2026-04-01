import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusIndicator } from './StatusIndicator';

test('StatusIndicator renders the correct status label per state, recording rules when recording, and nothing for idle', () => {
  // idle — renders nothing
  const r1 = render(<StatusIndicator status="idle" />);
  expect(screen.queryByRole('status')).toBeNull();
  r1.unmount();

  // ai_speaking — pulsing indicator
  const r2 = render(<StatusIndicator status="ai_speaking" />);
  expect(screen.getByText(/ai is speaking/i)).toBeInTheDocument();
  r2.unmount();

  // user_recording — shows recording rules
  const r3 = render(<StatusIndicator status="user_recording" />);
  expect(screen.getByText(/recording your answer/i)).toBeInTheDocument();
  expect(screen.getByText(/max answer length/i)).toBeInTheDocument();
  r3.unmount();

  // transcribing
  const r4 = render(<StatusIndicator status="transcribing" />);
  expect(screen.getByText(/transcribing/i)).toBeInTheDocument();
  r4.unmount();

  // generating
  const r5 = render(<StatusIndicator status="generating" />);
  expect(screen.getByText(/generating next question/i)).toBeInTheDocument();
  r5.unmount();

  // generating_feedback
  const r6 = render(<StatusIndicator status="generating_feedback" />);
  expect(screen.getByText(/generating feedback/i)).toBeInTheDocument();
  r6.unmount();

  // completed — no spinner
  const r7 = render(<StatusIndicator status="completed" />);
  expect(screen.getByText(/session complete/i)).toBeInTheDocument();
  r7.unmount();
});
