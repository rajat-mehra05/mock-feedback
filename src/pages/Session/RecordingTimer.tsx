import { useState, useEffect, useRef } from 'react';
import { MAX_RECORDING_SECONDS, RECORDING_WARNING_SECONDS } from '@/constants/session';

interface RecordingTimerProps {
  isActive: boolean;
  onMaxReached: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordingTimer({ isActive, onMaxReached }: RecordingTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const onMaxRef = useRef(onMaxReached);
  useEffect(() => {
    onMaxRef.current = onMaxReached;
  }, [onMaxReached]);

  useEffect(() => {
    if (!isActive) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      if (secs >= MAX_RECORDING_SECONDS) {
        onMaxRef.current();
      } else {
        setElapsed(secs);
      }
    }, 1000);
    return () => {
      clearInterval(interval);
      setElapsed(0);
    };
  }, [isActive]);

  if (!isActive) return null;

  const remaining = MAX_RECORDING_SECONDS - elapsed;
  const isWarning = remaining <= RECORDING_WARNING_SECONDS;

  return (
    <p
      className={`font-mono text-sm ${isWarning ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}
    >
      {formatTime(elapsed)}
      {isWarning && ` — ${remaining}s remaining`}
    </p>
  );
}
