// The client's modules touch the browser when they load; give them a stand-in for offline checks.
const el = () => new Proxy({}, { get: (_t, k) => (k === 'getContext' ? () => new Proxy({}, { get: () => () => ({}) }) : () => ({})) });
(globalThis as any).document ??= { createElement: el, getElementById: el, addEventListener() {} };
(globalThis as any).window ??= globalThis;
