import type { InterviewState } from '@/hooks/useInterviewSession/types';
import { RECORDING_RULES } from '@/constants/copy';
import { Spinner } from '@/components/ui/spinner';
import { SoundWavePulse } from './SoundWavePulse';

const STATUS_DISPLAY: Record<string, { label: string; pulse?: boolean; color?: string }> = {
  ai_speaking: { label: 'AI is speaking...' },
  user_recording: { label: 'Recording your answer...', pulse: true, color: 'bg-red-500' },
  skipping: { label: 'No response detected, moving to next question...' },
  generating_feedback: { label: 'Generating feedback...' },
  completed: { label: 'Session complete!' },
};

function getStatusDisplay(
  status: InterviewState,
  questionIndex: number,
  isStreaming: boolean,
  isPartial?: boolean,
): { label: string; pulse?: boolean; color?: string } | undefined {
  if (status === 'awaiting_transcript') return { label: 'Processing your answer...' };
  if (status === 'generating') {
    // Sentence-queue TTS is already playing while chat still streams, so
    // "AI is speaking..." is the honest label.
    if (isStreaming) return STATUS_DISPLAY.ai_speaking;
    return {
      label: questionIndex === 0 ? 'Generating first question...' : 'Generating next question...',
    };
  }
  if (status === 'completed' && isPartial)
    return { label: 'Session ended early — no questions were answered.' };
  if (status === 'generating_feedback')
    return { label: 'Generating your session feedback — hang tight...' };
  return STATUS_DISPLAY[status];
}

export function StatusIndicator({
  status,
  questionIndex,
  currentQuestion,
  isPartial,
}: {
  status: InterviewState;
  questionIndex: number;
  currentQuestion?: string | null;
  isPartial?: boolean;
}) {
  const isStreaming = status === 'generating' && !!currentQuestion;
  const display = getStatusDisplay(status, questionIndex, isStreaming, isPartial);
  if (!display) return null;

  const showSoundWave = status === 'ai_speaking' || isStreaming;

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label="Session status"
    >
      {showSoundWave && <SoundWavePulse />}
      {display.pulse && display.color && (
        <div className={`h-4 w-4 rounded-full ${display.color} motion-safe:animate-pulse`} />
      )}
      {!display.pulse && !showSoundWave && status !== 'completed' && <Spinner />}
      <p className="text-sm text-muted-foreground">{display.label}</p>
      {status === 'user_recording' && (
        <p className="text-xs text-muted-foreground">{RECORDING_RULES}</p>
      )}
    </div>
  );
}
