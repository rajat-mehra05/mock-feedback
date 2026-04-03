import { useState, useRef, useCallback, useEffect } from 'react';
import { AUDIO_MIME_TYPES } from '@/constants/openai';
import { SILENCE_TIMEOUT_SECONDS } from '@/constants/session';

/** RMS threshold below which audio is considered silence (0–1 scale). */
const SILENCE_THRESHOLD = 0.03;
/** How often (ms) we sample the audio level to check for silence. */
const POLL_INTERVAL_MS = 200;

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

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupSilenceDetector = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    cleanupSilenceDetector();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, [cleanupSilenceDetector]);

  const startRecording = useCallback(async () => {
    // Guard against overlapping recording sessions
    const existing = mediaRecorderRef.current;
    if (existing && existing.state !== 'inactive') return;

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

      recorder.onerror = () => {
        cleanupSilenceDetector();
        chunksRef.current = [];
        setAudioBlob(null);
        setIsRecording(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setError('Recording failed unexpectedly.');
      };

      recorder.start();
      setIsRecording(true);

      // Native silence detection via Web Audio API AnalyserNode
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const dataArray = new Float32Array(analyser.fftSize);
      let silentSince: number | null = null;
      let speechDetected = false;
      const recordingStartedAt = Date.now();

      silenceTimerRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(dataArray);

        // Calculate RMS (root mean square) volume level
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        if (rms > SILENCE_THRESHOLD) {
          speechDetected = true;
          silentSince = null;
        } else if (speechDetected) {
          // Only start counting silence after speech has been detected
          if (silentSince === null) {
            silentSince = Date.now();
          } else if (Date.now() - silentSince >= SILENCE_TIMEOUT_SECONDS * 1000) {
            stopRecording();
          }
        } else if (Date.now() - recordingStartedAt >= SILENCE_TIMEOUT_SECONDS * 1000) {
          // No speech detected at all — stop recording after timeout
          stopRecording();
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      cleanupSilenceDetector();
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.ondataavailable = null;
        rec.onstop = null;
        rec.onerror = null;
        rec.stop();
      }
      mediaRecorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone access is required. Please allow microphone access in your browser settings.'
          : 'Failed to start recording.';
      setError(msg);
    }
  }, [stopRecording, cleanupSilenceDetector]);

  // Release all resources on unmount
  useEffect(() => {
    return () => {
      cleanupSilenceDetector();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cleanupSilenceDetector]);

  const clearBlob = useCallback(() => setAudioBlob(null), []);

  return { startRecording, stopRecording, clearBlob, isRecording, audioBlob, error };
}
