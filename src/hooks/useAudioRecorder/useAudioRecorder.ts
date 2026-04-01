import { useState, useRef, useCallback, useEffect } from 'react';
import { AUDIO_MIME_TYPES } from '@/constants/openai';
import { SILENCE_TIMEOUT_SECONDS, SILENCE_RMS_THRESHOLD } from '@/constants/session';

interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearBlob: () => void;
  isRecording: boolean;
  audioBlob: Blob | null;
  error: string | null;
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  if (MediaRecorder.isTypeSupported(AUDIO_MIME_TYPES.WEBM)) return AUDIO_MIME_TYPES.WEBM;
  if (MediaRecorder.isTypeSupported(AUDIO_MIME_TYPES.MP4)) return AUDIO_MIME_TYPES.MP4;
  return '';
}

interface SilenceDetectionRefs {
  timer: React.RefObject<ReturnType<typeof setInterval> | null>;
  audioCtx: React.RefObject<AudioContext | null>;
}

function startSilenceDetection(
  stream: MediaStream,
  refs: SilenceDetectionRefs,
  onSilence: () => void,
) {
  const ctx = new AudioContext();
  refs.audioCtx.current = ctx;
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const dataArray = new Float32Array(analyser.fftSize);
  let silentSince: number | null = null;
  let hasSpoken = false;

  refs.timer.current = setInterval(() => {
    analyser.getFloatTimeDomainData(dataArray);
    const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length);

    if (rms >= SILENCE_RMS_THRESHOLD) {
      hasSpoken = true;
      silentSince = null;
      return;
    }

    if (!hasSpoken) return;

    if (!silentSince) {
      silentSince = Date.now();
      return;
    }

    if (Date.now() - silentSince >= SILENCE_TIMEOUT_SECONDS * 1000) {
      onSilence();
    }
  }, 200);
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const cleanupSilenceDetection = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    cleanupSilenceDetection();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, [cleanupSilenceDetection]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      setError('Your browser does not support audio recording.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);

      startSilenceDetection(
        stream,
        { timer: silenceTimerRef, audioCtx: audioContextRef },
        stopRecording,
      );
    } catch (err) {
      cleanupSilenceDetection();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access is required. Please allow microphone access in your browser settings.'
          : 'Failed to start recording.';
      setError(msg);
    }
  }, [stopRecording, cleanupSilenceDetection]);

  // Release all resources on unmount
  useEffect(() => {
    return () => {
      cleanupSilenceDetection();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cleanupSilenceDetection]);

  const clearBlob = useCallback(() => setAudioBlob(null), []);

  return { startRecording, stopRecording, clearBlob, isRecording, audioBlob, error };
}
