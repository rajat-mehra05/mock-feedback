import Dexie, { type EntityTable } from 'dexie';

interface ApiKeyEntry {
  id: string;
  key: string;
}

const keyDb = new Dexie('MockFeedbackKeyDB') as Dexie & {
  apiKeys: EntityTable<ApiKeyEntry, 'id'>;
};

keyDb.version(1).stores({
  apiKeys: 'id',
});

const KEY_ID = 'openai';

export async function saveApiKey(key: string): Promise<void> {
  await keyDb.apiKeys.put({ id: KEY_ID, key });
}

export async function getApiKey(): Promise<string | null> {
  const entry = await keyDb.apiKeys.get(KEY_ID);
  return entry?.key ?? null;
}

export async function deleteApiKey(): Promise<void> {
  await keyDb.apiKeys.delete(KEY_ID);
}
