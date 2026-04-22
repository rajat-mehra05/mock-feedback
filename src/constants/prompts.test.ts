import { expect, test } from 'vitest';
import { buildInterviewPrompt } from './prompts';

test('interviewer uses the candidate name when given a clean value, and addresses them in the system rules', () => {
  const prompt = buildInterviewPrompt({ topic: 'React', candidateName: 'Alice' });

  // Warm-intro rule references the name, and the constraints section reminds
  // the model to address the candidate by name.
  expect(prompt).toContain('Hey Alice');
  expect(prompt).toContain("candidate's name is Alice");
});

test('malicious or empty-after-sanitize candidate names are dropped rather than leaking into the prompt', () => {
  // `!!!@@@` sanitises to empty. The prompt must fall back to the anonymous
  // greeting instead of emitting "Hey , how are you doing?".
  const prompt = buildInterviewPrompt({ topic: 'React', candidateName: '!!!@@@' });

  expect(prompt).toContain('Hey there, how are you doing?');
  expect(prompt).not.toContain("candidate's name is");
});

test('topic value flows into the prompt for both the greeting and the role description', () => {
  // `.` is not in the allow-list of the prompt sanitiser, so "Node.js" becomes
  // "Nodejs". The sanitiser behaviour itself is part of the contract — a test
  // expecting the dot would silently break when someone tightens sanitation.
  const prompt = buildInterviewPrompt({ topic: 'Node.js' });

  expect(prompt).toContain('Nodejs technical interview');
  expect(prompt).toContain('especially with Nodejs');
});
