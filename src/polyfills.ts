import { Buffer } from 'buffer';

// Polyfill for Buffer
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill for setImmediate (used by some libraries)
if (typeof setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: any, ...args: any[]) => setTimeout(fn, 0, ...args);
}
