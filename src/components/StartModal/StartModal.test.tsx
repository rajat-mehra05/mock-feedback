import { expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { StartModal } from './StartModal';
import { platform, SECRET_OPENAI_API_KEY } from '@/platform';

const deleteApiKey = () => platform.storage.secrets.clear(SECRET_OPENAI_API_KEY);
const saveApiKey = (key: string) => platform.storage.secrets.set(SECRET_OPENAI_API_KEY, key);

test('first-time user sees API key input, saves key, sees Saved confirmation, then starts session', async () => {
  await deleteApiKey();
  const user = userEvent.setup();
  const onOpenChange = vi.fn();

  renderWithProviders(<StartModal open={true} onOpenChange={onOpenChange} />);

  expect(screen.getByText(/start a session/i)).toBeInTheDocument();

  // Wait for API key section to appear after loading resolves
  const keyInput = await screen.findByLabelText(/openai api key/i);

  // Start button disabled — no topic AND no key
  const startButton = screen.getByRole('button', { name: /start session/i });
  expect(startButton).toBeDisabled();
  await user.type(keyInput, 'sk-test-key');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  // API key section stays mounted but button shows "Saved"
  await waitFor(() => expect(screen.getByRole('button', { name: /^saved$/i })).toBeInTheDocument());
  expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument();

  // Still disabled — no topic selected yet
  expect(startButton).toBeDisabled();

  // Select a topic
  const topicTrigger = screen.getByLabelText(/interview topic/i);
  await user.click(topicTrigger);
  const reactOption = await screen.findByRole('option', { name: /react & next\.js/i });
  await user.click(reactOption);

  // Now enabled — start the session
  expect(startButton).toBeEnabled();
  await user.click(startButton);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test('topic dropdown renders grouped categories with all topics', async () => {
  await saveApiKey('sk-existing');
  const user = userEvent.setup();

  renderWithProviders(<StartModal open={true} onOpenChange={vi.fn()} />);

  // Open the dropdown
  const topicTrigger = await screen.findByLabelText(/interview topic/i);
  await user.click(topicTrigger);

  // Wait for dropdown portal to render
  await screen.findByRole('option', { name: /python/i });

  // Category headings are rendered as group labels
  expect(screen.getByText('Languages & Runtimes')).toBeInTheDocument();
  expect(screen.getByText('Frameworks')).toBeInTheDocument();
  expect(screen.getByText('Concepts')).toBeInTheDocument();
  expect(screen.getByText('Behavioral')).toBeInTheDocument();

  // Spot-check topics from different groups
  expect(screen.getByRole('option', { name: 'Go' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /system design \(backend\)/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /docker & kubernetes/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /behavioral & star/i })).toBeInTheDocument();
});

test('returning user with existing key does not see API key input', async () => {
  await deleteApiKey();
  await saveApiKey('sk-existing');
  const user = userEvent.setup();
  const onOpenChange = vi.fn();

  renderWithProviders(<StartModal open={true} onOpenChange={onOpenChange} />);

  // Key loaded — API key section not shown since user already had a key
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });
  expect(screen.queryByLabelText(/openai api key/i)).not.toBeInTheDocument();

  // Select topic and question count
  const topicTrigger = screen.getByLabelText(/interview topic/i);
  await user.click(topicTrigger);
  const reactOption = await screen.findByRole('option', { name: /react & next\.js/i });
  await user.click(reactOption);

  const countTrigger = screen.getByLabelText(/number of questions/i);
  await user.click(countTrigger);
  const sevenOption = await screen.findByRole('option', { name: /7 questions/i });
  await user.click(sevenOption);

  // Start session
  const startButton = screen.getByRole('button', { name: /start session/i });
  expect(startButton).toBeEnabled();
  await user.click(startButton);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
