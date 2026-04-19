import Dexie, { type EntityTable } from 'dexie';

interface PreferenceEntry {
  id: string;
  value: string;
}

const prefsDb = new Dexie('MockFeedbackPrefsDB') as Dexie & {
  preferences: EntityTable<PreferenceEntry, 'id'>;
};

prefsDb.version(1).stores({
  preferences: 'id',
});

const NAME_ID = 'candidateName';
const DEVICE_ID = 'deviceId';

export async function saveCandidateName(name: string): Promise<void> {
  await prefsDb.preferences.put({ id: NAME_ID, value: name });
}

export async function getCandidateName(): Promise<string | null> {
  const entry = await prefsDb.preferences.get(NAME_ID);
  return entry?.value ?? null;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const entry = await prefsDb.preferences.get(DEVICE_ID);
  if (entry?.value) return entry.value;
  const id = crypto.randomUUID();
  await prefsDb.preferences.put({ id: DEVICE_ID, value: id });
  return id;
}
