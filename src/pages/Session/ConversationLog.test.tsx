import { expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ConversationLog } from './ConversationLog';

test('renders nothing when history is empty and no current question', () => {
  renderWithProviders(
    <ConversationLog history={[]} currentQuestion={null} ttsFallbackText={null} />,
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByText('AI Interviewer')).not.toBeInTheDocument();
});

test('renders each history turn with question text and AI Interviewer label', () => {
  const history = [
    { question: 'What is a closure?', answer: 'A function that captures scope.' },
    { question: 'Explain the event loop.', answer: 'Single-threaded async model.' },
  ];

  renderWithProviders(
    <ConversationLog history={history} currentQuestion={null} ttsFallbackText={null} />,
  );

  expect(screen.getByText('What is a closure?')).toBeInTheDocument();
  expect(screen.getByText('Explain the event loop.')).toBeInTheDocument();
  expect(screen.getAllByText('AI Interviewer')).toHaveLength(2);
});

test('renders current question when provided', () => {
  renderWithProviders(
    <ConversationLog history={[]} currentQuestion="What is a closure?" ttsFallbackText={null} />,
  );

  expect(screen.getByText('What is a closure?')).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('prefers currentQuestion over ttsFallbackText', () => {
  renderWithProviders(
    <ConversationLog
      history={[]}
      currentQuestion="Primary question"
      ttsFallbackText="Fallback question"
    />,
  );

  expect(screen.getByText('Primary question')).toBeInTheDocument();
  expect(screen.queryByText('Fallback question')).not.toBeInTheDocument();
});

test('shows ttsFallbackText when currentQuestion is null', () => {
  renderWithProviders(
    <ConversationLog
      history={[]}
      currentQuestion={null}
      ttsFallbackText="Fallback question text"
    />,
  );

  expect(screen.getByText('Fallback question text')).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('scrolls to bottom when a new question is added', () => {
  const scrollIntoView = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

  const { rerender } = renderWithProviders(
    <ConversationLog
      history={[{ question: 'First question', answer: 'First answer' }]}
      currentQuestion={null}
      ttsFallbackText={null}
    />,
  );

  const callsBefore = scrollIntoView.mock.calls.length;

  rerender(
    <ConversationLog
      history={[
        { question: 'First question', answer: 'First answer' },
        { question: 'Second question', answer: 'Second answer' },
      ]}
      currentQuestion={null}
      ttsFallbackText={null}
    />,
  );

  expect(scrollIntoView.mock.calls.length).toBeGreaterThan(callsBefore);
});
