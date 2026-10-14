import { describe, expect, it } from 'vitest';
import { safeText } from '../src/terminal.ts';

describe('safeText', () => {
  it('escapes C0, DEL, C1 and line separators visibly', () => {
    expect(safeText('a\x1b[2K\rb\nc\td\x00e\x7ff\x85g\u2028h\u2029i')).toBe(
      'a\\x1b[2K\\x0db\\x0ac\\x09d\\x00e\\x7ff\\x85g\\u2028h\\u2029i',
    );
  });
  it('leaves ordinary text, including non-ASCII, untouched', () => {
    expect(safeText("import { openai } from '@ai-sdk/openai'; // café")).toBe(
      "import { openai } from '@ai-sdk/openai'; // café",
    );
  });
  it('leaves nothing that is a control character', () => {
    const all = Array.from({ length: 0xa0 }, (_, i) => String.fromCharCode(i)).join('');
    expect(safeText(all)).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
  });
});

describe('safeText bidi and format characters', () => {
  it('escapes bidi controls and invisible format characters', () => {
    expect(safeText('a\u202eb')).toBe('a\\u202eb');
    const all = '\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069\ufeff';
    const out = safeText(all);
    expect(out).toBe('\\u061c\\u200e\\u200f\\u202a\\u202b\\u202c\\u202d\\u202e\\u2066\\u2067\\u2068\\u2069\\ufeff');
    expect(out).not.toMatch(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/);
  });
  it('still leaves ordinary non-ASCII text alone', () => {
    expect(safeText('café 日本語 مرحبا')).toBe('café 日本語 مرحبا');
  });
});
