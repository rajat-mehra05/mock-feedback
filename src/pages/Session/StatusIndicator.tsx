import type { InterviewState } from '@/hooks/useInterviewSession/types';
import { RECORDING_RULES } from '@/constants/copy';

const STATUS_DISPLAY: Record<string, { label: string; pulse?: boolean; color?: string }> = {
  ai_speaking: { label: 'AI is speaking...', pulse: true, color: 'bg-blue-500' },
  user_recording: { label: 'Recording your answer...', pulse: true, color: 'bg-red-500' },
  transcribing: { label: 'Transcribing your answer...' },
  generating: { label: 'Generating next question...' },
  generating_feedback: { label: 'Generating feedback...' },
  completed: { label: 'Session complete!' },
};

export function StatusIndicator({ status }: { status: InterviewState }) {
  const display = STATUS_DISPLAY[status];
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
      {!display.pulse && status !== 'completed' && (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      )}
      <p className="text-sm text-muted-foreground">{display.label}</p>
      {status === 'user_recording' && (
        <p className="text-xs text-muted-foreground">{RECORDING_RULES}</p>
      )}
    </div>
  );
}
