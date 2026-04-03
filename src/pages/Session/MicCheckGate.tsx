import { useState, useEffect, useRef, type ReactNode } from 'react';
import { checkMediaRecorderSupport, checkMicDevices, checkMicPermission } from '@/lib/micCheck';
import {
  UNSUPPORTED_BROWSER_MESSAGE,
  NO_MIC_MESSAGE,
  MIC_PERMISSION_MESSAGE,
} from '@/constants/copy';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type CheckStatus = 'checking' | 'passed' | 'failed';
type CheckPhase = 'browser' | 'devices' | 'permission';

const MIC_CHECK_TIMEOUT_MS = 10_000;

const PHASE_MESSAGES: Record<CheckPhase, string> = {
  browser: 'Checking browser compatibility...',
  devices: 'Looking for microphone...',
  permission: 'Requesting microphone access — please allow when prompted...',
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export function MicCheckGate({ onReady, children }: { onReady: () => void; children: ReactNode }) {
  const [status, setStatus] = useState<CheckStatus>('checking');
  const [phase, setPhase] = useState<CheckPhase>('browser');
  const [errorMessage, setErrorMessage] = useState('');
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function runChecks() {
    const token = ++requestIdRef.current;

    // Phase 1: Browser compatibility
    setPhase('browser');
    if (!checkMediaRecorderSupport()) {
      if (!mountedRef.current || token !== requestIdRef.current) return;
      setErrorMessage(UNSUPPORTED_BROWSER_MESSAGE);
      setStatus('failed');
      return;
    }

    // Phase 2: Mic device detection
    if (!mountedRef.current || token !== requestIdRef.current) return;
    setPhase('devices');
    try {
      const hasDevices = await checkMicDevices();
      if (!mountedRef.current || token !== requestIdRef.current) return;
      if (!hasDevices) {
        setErrorMessage(NO_MIC_MESSAGE);
        setStatus('failed');
        return;
      }
    } catch {
      if (!mountedRef.current || token !== requestIdRef.current) return;
      setErrorMessage(NO_MIC_MESSAGE);
      setStatus('failed');
      return;
    }

    // Phase 3: Mic permission
    if (!mountedRef.current || token !== requestIdRef.current) return;
    setPhase('permission');

    // Fast-path: check permission state before calling getUserMedia
    let permissionState: string | null;
    try {
      permissionState = await checkMicPermission();
    } catch {
      if (!mountedRef.current || token !== requestIdRef.current) return;
      setErrorMessage(MIC_PERMISSION_MESSAGE);
      setStatus('failed');
      return;
    }
    if (!mountedRef.current || token !== requestIdRef.current) return;

    if (permissionState === 'denied') {
      setErrorMessage(MIC_PERMISSION_MESSAGE);
      setStatus('failed');
      return;
    }

    if (permissionState !== 'granted') {
      // Permission is 'prompt' — need to call getUserMedia with a timeout
      try {
        await withTimeout(
          navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
            s.getTracks().forEach((t) => t.stop());
          }),
          MIC_CHECK_TIMEOUT_MS,
          'timeout',
        );
      } catch {
        if (!mountedRef.current || token !== requestIdRef.current) return;
        setErrorMessage(MIC_PERMISSION_MESSAGE);
        setStatus('failed');
        return;
      }
    }

    if (!mountedRef.current || token !== requestIdRef.current) return;
    setStatus('passed');
    onReady();
  }

  useEffect(() => {
    mountedRef.current = true;
    void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Spinner message={PHASE_MESSAGES[phase]} />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="max-w-md text-sm text-foreground">{errorMessage}</p>
        <Button
          variant="outline"
          onClick={() => {
            setStatus('checking');
            setPhase('browser');
            void runChecks();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
