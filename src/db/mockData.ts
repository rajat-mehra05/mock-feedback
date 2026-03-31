import type { Session } from './index';

export const mockSessions: Session[] = [
  {
    id: 'session-1',
    topic: 'JavaScript / TypeScript',
    createdAt: new Date('2026-03-28T10:30:00'),
    duration: 840,
    questionCount: 5,
    averageScore: 7.4,
    questions: [
      {
        id: 'q1-1',
        questionText:
          'Can you explain how closures work in JavaScript and give a practical example?',
        userTranscript:
          'A closure is when a function remembers the variables from its outer scope even after the outer function has returned. For example, you can create a counter function that returns an increment function, and the inner function still has access to the count variable.',
        rating: 8,
        feedback:
          'Good explanation of closures with a practical example. You correctly identified that closures capture variables from their enclosing scope. To strengthen your answer, you could mention lexical scoping and how closures are used in real-world patterns like module patterns or event handlers.',
      },
      {
        id: 'q1-2',
        questionText: 'What is the difference between var, let, and const?',
        userTranscript:
          'Var is function scoped and gets hoisted. Let and const are block scoped. Const means you cannot reassign the variable but the value itself can still be mutated if it is an object.',
        rating: 7,
        feedback:
          'Solid answer covering the key differences. You correctly noted the scoping differences and the mutability nuance with const. Consider also mentioning the temporal dead zone for let/const and why var is generally avoided in modern code.',
      },
      {
        id: 'q1-3',
        questionText: 'How does the JavaScript event loop work?',
        userTranscript:
          'The event loop checks the call stack and if it is empty it takes the first callback from the task queue and pushes it onto the call stack. There are also microtasks like promises that have higher priority.',
        rating: 7,
        feedback:
          'Good high-level understanding. You correctly mentioned the call stack, task queue, and microtask priority. To improve, discuss the difference between macrotasks and microtasks in more detail, and mention how setTimeout with 0ms delay actually works.',
      },
      {
        id: 'q1-4',
        questionText: 'Explain the difference between == and === in JavaScript.',
        userTranscript:
          'Double equals does type coercion before comparing, so the string 5 would equal the number 5. Triple equals checks both type and value without coercion, so they would not be equal.',
        rating: 8,
        feedback:
          'Clear and accurate explanation with a good example. You demonstrated understanding of type coercion. For a stronger answer, mention the abstract equality comparison algorithm and edge cases like null == undefined being true.',
      },
      {
        id: 'q1-5',
        questionText: 'What are TypeScript generics and when would you use them?',
        userTranscript:
          'Generics let you write functions and classes that work with multiple types while still being type safe. Like you can make a function that takes any type T and returns that same type, so the compiler knows the return type matches the input.',
        rating: 7,
        feedback:
          'Good conceptual understanding. Your explanation of type parameterization is correct. Consider providing a concrete example like a generic API response wrapper or a typed useState hook to demonstrate practical usage.',
      },
    ],
  },
  {
    id: 'session-2',
    topic: 'React & Next.js',
    createdAt: new Date('2026-03-30T14:15:00'),
    duration: 720,
    questionCount: 5,
    averageScore: 8.0,
    questions: [
      {
        id: 'q2-1',
        questionText: 'What is the virtual DOM and how does React use it?',
        userTranscript:
          'The virtual DOM is an in-memory representation of the real DOM. When state changes, React creates a new virtual DOM tree, diffs it with the previous one, and only updates the parts of the real DOM that actually changed. This is called reconciliation.',
        rating: 9,
        feedback:
          'Excellent answer. You accurately described the virtual DOM, the diffing process, and used the correct term "reconciliation." To make it perfect, mention React Fiber and how it enables concurrent rendering.',
      },
      {
        id: 'q2-2',
        questionText: 'Explain the rules of React hooks.',
        userTranscript:
          'Hooks must be called at the top level of a component, not inside conditions or loops. They can only be called from React function components or custom hooks. This is because React relies on the order of hook calls to maintain state correctly.',
        rating: 8,
        feedback:
          'Well-articulated answer covering both rules. The explanation of why the order matters shows deeper understanding. You could also mention the ESLint plugin for hooks that enforces these rules automatically.',
      },
      {
        id: 'q2-3',
        questionText: 'When would you use useMemo vs useCallback?',
        userTranscript:
          'UseMemo memoizes a computed value and useCallback memoizes a function reference. You use useMemo when you have an expensive calculation and useCallback when you pass callbacks to child components that rely on reference equality to prevent re-renders.',
        rating: 8,
        feedback:
          'Accurate distinction. Good mention of reference equality for child component optimization. Consider discussing when NOT to use them — premature optimization is a common pitfall, and React 19 compiler may handle this automatically.',
      },
      {
        id: 'q2-4',
        questionText: 'What is the difference between SSR and SSG in Next.js?',
        userTranscript:
          'SSR renders the page on every request on the server, so the content is always fresh. SSG generates the HTML at build time, so it is faster but the content is static until the next build. You can also use ISR to revalidate static pages at intervals.',
        rating: 8,
        feedback:
          'Strong answer covering SSR, SSG, and ISR. You correctly identified the trade-offs between freshness and performance. With Next.js App Router, you should also mention the shift toward React Server Components and how they change this model.',
      },
      {
        id: 'q2-5',
        questionText: 'How do you handle global state in a React application?',
        userTranscript:
          'You can use React Context with useReducer for simpler cases. For more complex state, libraries like Zustand or Redux Toolkit work well. The choice depends on the size and complexity of the application. I prefer Zustand for most projects because it is simple and performant.',
        rating: 7,
        feedback:
          'Good overview of state management options with a clear personal preference. The answer would be stronger with discussion of when Context is sufficient vs when a library is warranted, and the re-render implications of Context.',
      },
    ],
  },
];
