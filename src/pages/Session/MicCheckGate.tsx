import { useState, useEffect, useRef, type ReactNode } from 'react';
import { checkMediaRecorderSupport, checkMicDevices, checkMicPermission } from '@/lib/micCheck';
import {
  canOpenMicSettings,
  classifyMicError,
  micError,
  openMicSettings,
  type MicError,
} from '@/lib/micError';
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
  const [failure, setFailure] = useState<MicError | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function runChecks() {
    const token = ++requestIdRef.current;
    const isActive = () => mountedRef.current && token === requestIdRef.current;

    // Phase 1: Browser compatibility
    setPhase('browser');
    if (!checkMediaRecorderSupport()) {
      if (!isActive()) return;
      setFailure(micError('unsupported'));
      setStatus('failed');
      return;
    }

    // Phase 2: Mic device detection
    if (!isActive()) return;
    setPhase('devices');
    try {
      const hasDevices = await checkMicDevices();
      if (!isActive()) return;
      if (!hasDevices) {
        setFailure(micError('no-device'));
        setStatus('failed');
        return;
      }
    } catch {
      if (!isActive()) return;
      setFailure(micError('no-device'));
      setStatus('failed');
      return;
    }

    // Phase 3: Mic permission
    if (!isActive()) return;
    setPhase('permission');

    let permissionState: string | null = null;
    try {
      permissionState = await checkMicPermission();
    } catch {
      // Unsupported — fall through to the getUserMedia prompt.
    }
    if (!isActive()) return;

    if (permissionState === 'denied') {
      setFailure(micError('permission-denied'));
      setStatus('failed');
      return;
    }

    if (permissionState !== 'granted') {
      try {
        await withTimeout(
          navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
            s.getTracks().forEach((t) => t.stop());
          }),
          MIC_CHECK_TIMEOUT_MS,
          'timeout',
        );
      } catch (err) {
        if (!isActive()) return;
        setFailure(classifyMicError(err));
        setStatus('failed');
        return;
      }
    }

    if (!isActive()) return;
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

  if (status === 'failed' && failure) {
    const showSettings =
      (failure.kind === 'permission-denied' || failure.kind === 'permission-revoked') &&
      canOpenMicSettings();
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="max-w-md text-sm text-foreground" role="alert">
          {failure.message}
        </p>
        <div className="flex gap-2">
          {showSettings && (
            <Button variant="outline" onClick={openMicSettings}>
              Open System Settings
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setStatus('checking');
              setPhase('browser');
              setFailure(null);
              void runChecks();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
