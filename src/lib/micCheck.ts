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
