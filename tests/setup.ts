import { format } from 'node:util';

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

const R3F_DOM_WARNING_PATTERNS: (string | RegExp)[] = [
  'React does not recognize the `castShadow` prop on a DOM element',
  'React does not recognize the `receiveShadow` prop on a DOM element',
  /React does not recognize the `[^`]+` prop on a DOM element/,
  'is using incorrect casing. Use PascalCase for React components, or lowercase for HTML elements.',
  'useLayoutEffect does nothing on the server',
];

function shouldFilterMessage(...args: unknown[]): boolean {
  if (args.length === 0) return false;
  const message = typeof args[0] === 'string' ? format(...args) : '';
  return R3F_DOM_WARNING_PATTERNS.some((pattern) =>
    typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message)
  );
}

console.error = (...args: unknown[]) => {
  if (shouldFilterMessage(...args)) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: unknown[]) => {
  if (shouldFilterMessage(...args)) {
    return;
  }
  originalConsoleWarn(...args);
};
