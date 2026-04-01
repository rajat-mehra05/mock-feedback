import { expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useApiKey } from './useApiKey';

test('useApiKey throws when used outside ApiKeyProvider', () => {
  expect(() => renderHook(() => useApiKey())).toThrow(
    'useApiKey must be used within ApiKeyProvider',
  );
});
