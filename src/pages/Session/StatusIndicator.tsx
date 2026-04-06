import type { InterviewState } from '@/hooks/useInterviewSession/types';
import { RECORDING_RULES } from '@/constants/copy';
import { Spinner } from '@/components/ui/spinner';

const STATUS_DISPLAY: Record<string, { label: string; pulse?: boolean; color?: string }> = {
  ai_speaking: { label: 'AI is speaking...', pulse: true, color: 'bg-blue-500' },
  user_recording: { label: 'Recording your answer...', pulse: true, color: 'bg-red-500' },
  skipping: { label: 'No response detected, moving to next question...' },
  generating_feedback: { label: 'Generating feedback...' },
  completed: { label: 'Session complete!' },
};

export function StatusIndicator({
  status,
  questionIndex,
  isPartial,
}: {
  status: InterviewState;
  questionIndex: number;
  isPartial?: boolean;
}) {
  const display =
    status === 'awaiting_transcript'
      ? { label: 'Processing your answer...' }
      : status === 'generating'
        ? {
            label:
              questionIndex === 0 ? 'Generating first question...' : 'Generating next question...',
          }
        : status === 'completed' && isPartial
          ? { label: 'Session ended early — no questions were answered.' }
          : status === 'generating_feedback'
            ? { label: 'Generating your session feedback — hang tight...' }
            : STATUS_DISPLAY[status];
  if (!display) return null;

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label="Session status"
    >
      {display.pulse && display.color && (
        <div className={`h-4 w-4 rounded-full ${display.color} motion-safe:animate-pulse`} />
      )}
      {!display.pulse && status !== 'completed' && <Spinner />}
      <p className="text-sm text-muted-foreground">{display.label}</p>
      {status === 'user_recording' && (
        <p className="text-xs text-muted-foreground">{RECORDING_RULES}</p>
      )}
    </div>
  );
}
