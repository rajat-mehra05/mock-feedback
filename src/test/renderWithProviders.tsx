import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiKeyProvider } from '@/hooks/ApiKeyContext/ApiKeyContext';
import type { ReactElement } from 'react';

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { initialRoute = '/', ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[initialRoute]}>
        <ApiKeyProvider>{children}</ApiKeyProvider>
      </MemoryRouter>
    ),
    ...renderOptions,
  });
}
