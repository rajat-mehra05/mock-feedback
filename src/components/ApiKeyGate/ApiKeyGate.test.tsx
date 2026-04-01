import { expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ApiKeyGate } from './ApiKeyGate';
import { deleteApiKey, saveApiKey } from '@/db/apiKey/apiKey';

test('new user sees key prompt, enters key, toggles visibility, saves, and sees children', async () => {
  await deleteApiKey();
  const user = userEvent.setup();

  renderWithProviders(
    <ApiKeyGate>
      <div>App Content</div>
    </ApiKeyGate>,
  );

  // Gate is shown
  expect(await screen.findByText(/welcome to mock feedback/i)).toBeInTheDocument();
  expect(screen.getByText(/requires your own openai api key/i)).toBeInTheDocument();
  expect(screen.queryByText('App Content')).not.toBeInTheDocument();

  // OpenAI link is present
  expect(screen.getByRole('link', { name: /get one from openai/i })).toHaveAttribute(
    'href',
    'https://platform.openai.com/api-keys',
  );

  // Toggle password visibility
  const input = screen.getByLabelText(/openai api key/i);
  expect(input).toHaveAttribute('type', 'password');
  await user.click(screen.getByRole('button', { name: /show api key/i }));
  expect(input).toHaveAttribute('type', 'text');
  await user.click(screen.getByRole('button', { name: /hide api key/i }));
  expect(input).toHaveAttribute('type', 'password');

  // Save button disabled when input is empty
  expect(screen.getByRole('button', { name: /save & continue/i })).toBeDisabled();

  // Enter and save a key
  await user.type(input, 'sk-test-key-12345');
  expect(screen.getByRole('button', { name: /save & continue/i })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: /save & continue/i }));

  // Children now visible
  expect(await screen.findByText('App Content')).toBeInTheDocument();
});

test('returning user with saved key goes straight to children', async () => {
  await deleteApiKey();
  await saveApiKey('sk-existing-key');

  renderWithProviders(
    <ApiKeyGate>
      <div>App Content</div>
    </ApiKeyGate>,
  );

  expect(await screen.findByText('App Content')).toBeInTheDocument();
  expect(screen.queryByText(/welcome to mock feedback/i)).not.toBeInTheDocument();
});
