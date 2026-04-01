import { expect, test, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StartModal } from './StartModal';

test('user opens modal, selects topic and question count, then starts session', async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();

  render(
    <MemoryRouter>
      <StartModal open={true} onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );

  // Modal content visible with how-it-works steps
  expect(screen.getByText(/welcome to mock feedback/i)).toBeInTheDocument();
  expect(screen.getByText(/choose a topic/i)).toBeInTheDocument();

  // Start button disabled without topic
  const startButton = screen.getByRole('button', { name: /start session/i });
  expect(startButton).toBeDisabled();

  // Select a topic — base-ui uses button with aria-haspopup="listbox"
  const topicTrigger = screen.getByLabelText(/interview topic/i);
  await user.click(topicTrigger);
  const reactOption = await screen.findByRole('option', { name: /react & next\.js/i });
  await user.click(reactOption);

  // Select question count
  const countTrigger = screen.getByLabelText(/number of questions/i);
  await user.click(countTrigger);
  const sevenOption = await screen.findByRole('option', { name: /7 questions/i });
  await user.click(sevenOption);

  // Start button now enabled and click it
  expect(startButton).toBeEnabled();
  await user.click(startButton);

  // Modal closed
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test('start button stays disabled when no topic is selected', () => {
  render(
    <MemoryRouter>
      <StartModal open={true} onOpenChange={() => {}} />
    </MemoryRouter>,
  );

  expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
});
