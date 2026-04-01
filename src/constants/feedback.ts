export const FEEDBACK_MODEL = 'gpt-4o-mini';
export const FEEDBACK_TIMEOUT_MS = 45_000;
export const FEEDBACK_TEMPERATURE = 0.4;
export const FEEDBACK_MAX_TOKENS = 2000;

export const FEEDBACK_SYSTEM_PROMPT =
  'You are a senior technical interviewer providing feedback on a {topic} interview. ' +
  'For each question-answer pair, provide: a rating (1-10), specific feedback on what ' +
  'was good and what was missed, and a concise model answer. Also provide an overall ' +
  'performance summary. Respond ONLY with valid JSON matching this exact schema: ' +
  '{ "questions": [{ "rating": number, "feedback": string, "modelAnswer": string }], ' +
  '"summary": string }';
