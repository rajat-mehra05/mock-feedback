import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner } from './spinner';

test('renders spinner with default aria-label when no message is provided', () => {
  render(<Spinner />);

  const status = screen.getByRole('status');
  expect(status).toHaveAccessibleName('Loading');
  expect(screen.queryByText(/./)).not.toBeInTheDocument();
});

test('renders spinner with visible message and matching aria-label', () => {
  render(<Spinner message="Loading sessions..." />);

  const status = screen.getByRole('status');
  expect(status).toHaveAccessibleName('Loading sessions...');
  expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
});

test('centered spinner is viewport-centered with larger size', () => {
  render(<Spinner centered message="Loading..." />);

  const wrapper = screen.getByRole('status').parentElement!;
  expect(wrapper.className).toMatch(/fixed/);
  expect(wrapper.className).toMatch(/inset-0/);
  expect(wrapper.className).toMatch(/z-50/);

  const spinner = screen.getByRole('status');
  expect(spinner.className).toMatch(/h-12/);
  expect(spinner.className).toMatch(/w-12/);
});
