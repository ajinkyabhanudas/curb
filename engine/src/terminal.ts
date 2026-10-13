// engine/src/terminal.ts
const UNSAFE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]', 'g');

/** Replace control characters with visible escapes so untrusted text cannot drive the terminal. */
export function safeText(s: string): string {
  return s.replace(UNSAFE, (c) => {
    const code = c.charCodeAt(0);
    return code < 0x100 ? `\\x${code.toString(16).padStart(2, '0')}` : `\\u${code.toString(16).padStart(4, '0')}`;
  });
}
