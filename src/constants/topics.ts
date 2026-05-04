export const TOPIC_GROUPS = [
  {
    category: 'Languages & Runtimes',
    topics: [
      { value: 'javascript-typescript', label: 'JavaScript & TypeScript' },
      { value: 'python', label: 'Python' },
      { value: 'go', label: 'Go' },
      { value: 'java', label: 'Java' },
      { value: 'rust', label: 'Rust' },
    ],
  },
  {
    category: 'Frameworks',
    topics: [
      { value: 'react-nextjs', label: 'React & Next.js' },
      { value: 'nodejs', label: 'Node.js' },
      { value: 'fastapi-django', label: 'FastAPI & Django' },
    ],
  },
  {
    category: 'Concepts',
    topics: [
      { value: 'system-design-frontend', label: 'System Design (Frontend)' },
      { value: 'system-design-backend', label: 'System Design (Backend)' },
      { value: 'system-design-fullstack', label: 'System Design (Full-Stack)' },
      { value: 'docker-kubernetes', label: 'Docker & Kubernetes' },
      { value: 'aws-cloud', label: 'AWS & Cloud' },
      { value: 'graphql', label: 'GraphQL' },
    ],
  },
  {
    category: 'QA & Test Engineering',
    topics: [
      { value: 'qa-manual', label: 'Manual & Exploratory QA' },
      { value: 'qa-sdet', label: 'SDET / Test Automation' },
      { value: 'qa-ui-automation', label: 'UI Test Automation' },
      { value: 'qa-api-automation', label: 'API Test Automation' },
      { value: 'qa-performance', label: 'Performance Testing' },
    ],
  },
  {
    category: 'Behavioral',
    topics: [{ value: 'behavioral', label: 'Behavioral & STAR' }],
  },
] as const;

/** Literal union of all topic values — derived from the const declaration. */
export type TopicValue = (typeof TOPIC_GROUPS)[number]['topics'][number]['value'];

/** Flat list of all topics — derived from groups. */
export const TOPICS: readonly { value: TopicValue; label: string }[] = TOPIC_GROUPS.flatMap((g) => [
  ...g.topics,
]);

export const TOPIC_LABELS = Object.fromEntries(TOPICS.map((t) => [t.value, t.label])) as Record<
  TopicValue,
  string
>;

/*
  Scope guardrails for topics where adjacent disciplines blur (e.g. API vs UI
  test automation). Only present for entries that need explicit steering;
  buildInterviewPrompt / buildFeedbackPrompt no-op when absent.
*/
export interface TopicScope {
  readonly focus: readonly string[];
  readonly outOfScope: readonly string[];
}

const TOPIC_SCOPES: Partial<Record<TopicValue, TopicScope>> = {
  'qa-manual': {
    focus: [
      'test plan and test case design',
      'exploratory testing technique',
      'bug reporting (steps, severity vs priority, repro quality)',
      'regression strategy',
      'equivalence partitioning and boundary value analysis',
      'risk-based testing',
    ],
    outOfScope: [
      'writing automation code',
      'UI or API automation frameworks',
      'load and performance testing',
      'security testing',
    ],
  },
  'qa-sdet': {
    focus: [
      'test pyramid and where to place each test',
      'automation framework design (runners, assertions, reporting)',
      'CI integration and parallel execution',
      'flake control and test isolation',
      'test data strategy and fixtures',
      'when to mock vs when to use real systems',
    ],
    outOfScope: [
      'manual exploratory technique',
      'load and performance testing',
      'deep frontend or backend product engineering',
    ],
  },
  'qa-ui-automation': {
    focus: [
      'Playwright, Cypress, Selenium',
      'locator strategies and selector resilience',
      'page object model and test structure',
      'network stubbing and request mocking',
      'handling async UI, waits, and timing',
      'visual regression and snapshot testing',
    ],
    outOfScope: [
      'API-only or contract testing',
      'manual QA process',
      'load and performance testing',
      'backend product code',
    ],
  },
  'qa-api-automation': {
    focus: [
      'REST and GraphQL contract testing',
      'request and response schema validation',
      'auth flows (OAuth, JWT, session)',
      'test data fixtures and environment isolation',
      'tools: Postman/Newman, RestAssured, Pact, supertest',
      'mocking external services and stubbing dependencies',
    ],
    outOfScope: [
      'UI or browser-based testing',
      'load and performance testing',
      'manual exploratory QA',
    ],
  },
  'qa-performance': {
    focus: [
      'k6, JMeter, Gatling',
      'load profiles: smoke, load, stress, soak, spike',
      'latency percentiles (p50, p95, p99) and throughput',
      'bottleneck identification and root-cause analysis',
      'observability metrics during load tests',
      'capacity planning and SLO validation',
    ],
    outOfScope: [
      'functional UI or API correctness testing',
      'manual QA process',
      'security testing',
    ],
  },
};

export function getTopicScope(value: TopicValue): TopicScope | undefined {
  return TOPIC_SCOPES[value];
}

export const QUESTION_COUNTS = [5, 7, 10] as const;

export const DEFAULT_QUESTION_COUNT = '5';

export const DEFAULT_TOPIC: TopicValue = 'javascript-typescript';

const VALID_TOPICS = new Set<TopicValue>(TOPICS.map((t) => t.value));

export function toValidTopic(raw: string | null): TopicValue {
  const value = raw ?? DEFAULT_TOPIC;
  return VALID_TOPICS.has(value as TopicValue) ? (value as TopicValue) : DEFAULT_TOPIC;
}
