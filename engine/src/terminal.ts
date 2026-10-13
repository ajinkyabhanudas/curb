// engine/src/terminal.ts
// C0, DEL, C1, line/paragraph separators, plus bidi controls and invisible format characters
// (U+061C, U+200E/F, U+202A-202E, U+2066-2069, U+FEFF) that can visually reorder or hide text.
const UNSAFE = new RegExp(
  '[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u061c\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]',
  'g',
);

/** Replace control and bidi characters with visible escapes so untrusted text cannot drive the terminal or reorder displayed text. */
export function safeText(s: string): string {
  return s.replace(UNSAFE, (c) => {
    const code = c.charCodeAt(0);
    return code < 0x100 ? `\\x${code.toString(16).padStart(2, '0')}` : `\\u${code.toString(16).padStart(4, '0')}`;
  });
}
