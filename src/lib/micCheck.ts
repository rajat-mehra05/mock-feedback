export function checkMediaRecorderSupport(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

export async function checkMicDevices(): Promise<boolean> {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.some((d) => d.kind === 'audioinput');
}

export async function checkMicPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    // permissions.query not supported in all browsers — assume prompt
    return 'prompt';
  }
}

/**
 * Subscribes to mid-session permission state changes. Fires the callback every
 * time the permission state transitions (e.g. user revokes mic access in
 * system settings while a recording is active). Returns an unsubscribe fn.
 *
 * No-ops silently if `navigator.permissions.query` is unsupported.
 */
export function watchMicPermission(
  cb: (state: 'granted' | 'denied' | 'prompt') => void,
): () => void {
  if (!navigator.permissions?.query) return () => {};

  let status: PermissionStatus | null = null;
  let disposed = false;
  const handler = () => {
    if (status) cb(status.state as 'granted' | 'denied' | 'prompt');
  };

  void navigator.permissions
    .query({ name: 'microphone' as PermissionName })
    .then((s) => {
      if (disposed) return;
      status = s;
      s.addEventListener('change', handler);
    })
    .catch(() => {
      // unsupported name or rejected — silent
    });

  return () => {
    disposed = true;
    if (status) status.removeEventListener('change', handler);
    status = null;
  };
}
