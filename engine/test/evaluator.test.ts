// engine/test/evaluator.test.ts
import { chmod, mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { EVALUATOR_VERSION, IGNORABLE_EXT, evaluate, scanFile } from '../src/evaluator/evaluate.ts';
import { loadCard, type PolicyCard } from '../src/policy/card.ts';
import { takeSnapshot } from '../src/snapshot/snapshot.ts';
import { CARD_PATH, makeRepo } from './helpers.ts';

let card: PolicyCard;
beforeAll(async () => {
  card = (await loadCard(CARD_PATH)).card;
});

async function run(files: Record<string, string>, allowlist = ['anthropic']) {
  const snapshot = await takeSnapshot(await makeRepo(files), { skipDirs: card.exclusions.dirs });
  return evaluate({ snapshot, card, allowlist });
}

async function runDir(dir: string, maxFileBytes?: number, allowlist = ['anthropic']) {
  const snapshot = await takeSnapshot(dir, { skipDirs: card.exclusions.dirs, maxFileBytes });
  return evaluate({ snapshot, card, allowlist });
}

describe('evaluate: findings', () => {
  it('fails on an import of a provider outside the allowlist, with exact evidence', async () => {
    const src = "import { openai } from '@ai-sdk/openai';\n";
    const out = await run({ 'a.ts': src });
    expect(out.state).toBe('fail');
    expect(out.findings).toHaveLength(1);
    const f = out.findings[0];
    expect(f.providerId).toBe('openai');
    expect(f.matched).toBe('@ai-sdk/openai');
    expect(f.evidence.path).toBe('a.ts');
    expect(f.evidence.start).toBe(src.indexOf("'@ai-sdk/openai'"));
    expect(f.evidence.line).toBe(1);
    expect(f.evidence.column).toBe(src.indexOf("'@ai-sdk/openai'") + 1);
    expect(f.evidence.excerpt).toBe("import { openai } from '@ai-sdk/openai';");
  });

  it('passes when every referenced provider is allowed', async () => {
    const out = await run({ 'a.ts': "import { anthropic } from '@ai-sdk/anthropic';\n" });
    expect(out.state).toBe('pass');
    expect(out.filesEvaluated).toBe(1);
  });

  it('catches require and dynamic import', async () => {
    const out = await run({ 'a.js': "const o = require('openai');\nconst p = await import('openai');\n" });
    expect(out.findings).toHaveLength(2);
  });

  it('catches provider URL literals but not look-alike URLs', async () => {
    const hit = await run({ 'a.ts': "fetch('https://api.openai.com/v1/chat');\n" });
    expect(hit.state).toBe('fail');
    const miss = await run({ 'a.ts': "fetch('https://example.com/openai');\n" });
    expect(miss.state).toBe('pass');
  });

  it('checks gateway model identifiers by provider prefix', async () => {
    expect((await run({ 'a.ts': "gateway('openai/gpt-5');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "gateway.languageModel('openai/gpt-5');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "gateway('anthropic/claude');\n" })).state).toBe('pass');
    expect((await run({ 'a.ts': "gateway('unregistered/model');\n" })).state).toBe('pass');
  });

  it('recognises a gateway callee split across lines or wrapped in parentheses', async () => {
    expect((await run({ 'a.ts': "gateway\n  .languageModel('openai/gpt-5');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "(gateway)('openai/gpt-5');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "gateway /* c */ . languageModel('openai/gpt-5');\n" })).state).toBe('fail');
  });

  it('catches import-equals require and type-only imports', async () => {
    expect((await run({ 'a.ts': "import o = require('openai');\n" })).findings).toHaveLength(1);
    expect((await run({ 'a.ts': "import type { X } from 'openai';\n" })).findings).toHaveLength(1);
  });

  it('ignores comments, plain strings, variable names and unregistered look-alike packages', async () => {
    const src = [
      "// we used openai('gpt-4o') once",
      "const openai = 'openai is a word';",
      "import tools from 'openai-tools';",
      '',
    ].join('\n');
    expect((await run({ 'a.ts': src })).state).toBe('pass');
  });

  it('does not crash or match on inherited-property keys (review focus 1)', async () => {
    const src = [
      "fetch('http://constructor/x');",
      "gateway('constructor/x');",
      "gateway('__proto__/x');",
      "fetch('http://__proto__/x');",
      '',
    ].join('\n');
    const out = await run({ 'a.ts': src });
    expect(out.state).toBe('pass');
  });

  it('sorts findings by path then offset and de-duplicates', async () => {
    const out = await run({
      'z.ts': "import a from 'openai';\n",
      'a.ts': "import b from 'openai';\nimport c from '@ai-sdk/openai';\n",
    });
    expect(out.findings.map((f) => `${f.evidence.path}:${f.evidence.line}`)).toEqual(['a.ts:1', 'a.ts:2', 'z.ts:1']);
  });
});

describe('evaluate: unknown, scope and exclusions', () => {
  it('reports unknown for a parse error', async () => {
    const out = await run({ 'a.ts': 'const = ;\n' });
    expect(out.state).toBe('unknown');
    expect(out.unknownFiles).toEqual([{ path: 'a.ts', reason: 'parse-error' }]);
  });

  it('keeps fail when another file is unknown, and still lists the unknown file', async () => {
    const out = await run({ 'a.ts': "import a from 'openai';\n", 'b.ts': 'const = ;\n' });
    expect(out.state).toBe('fail');
    expect(out.unknownFiles).toHaveLength(1);
  });

  it('reports unknown for minified and generated files', async () => {
    const out = await run({
      'bundle.min.js': 'var a=1;',
      'long.js': `var s="${'x'.repeat(1200)}";`,
      'gen.ts': '// @generated by tool\nexport const a = 1;\n',
    });
    expect(out.unknownFiles.map((u) => `${u.path}:${u.reason}`)).toEqual([
      'bundle.min.js:minified',
      'gen.ts:generated',
      'long.js:minified',
    ]);
    expect(out.state).toBe('unknown');
  });

  it('reports unknown for unsupported languages', async () => {
    const out = await run({ 'tool.py': 'import openai\n' });
    expect(out.unknownFiles).toEqual([{ path: 'tool.py', reason: 'unsupported-language' }]);
    expect(out.state).toBe('unknown');
  });

  it('ignores excluded directories and lockfiles', async () => {
    const out = await run({
      'node_modules/openai/index.js': "require('openai');\n",
      'ok.ts': 'export const a = 1;\n',
    });
    expect(out.state).toBe('pass');
    expect(out.filesEvaluated).toBe(1);
  });

  it('is unknown, never pass, when there are no evaluable files (review focus 2)', async () => {
    const out = await run({ 'README.md': '# hi\n', 'package.json': '{}' });
    expect(out.state).toBe('unknown');
    expect(out.notes).toEqual(['no-evaluable-files']);
  });

  it('evaluates a file with a BOM and CRLF endings (review focus 3)', async () => {
    const out = await run({ 'a.ts': "\uFEFFimport x from 'openai';\r\nexport const y = 1;\r\n" });
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('fail');
    expect(out.findings).toHaveLength(1);
    const src = "\uFEFFimport x from 'openai';\n";
    expect(out.findings[0].evidence.start).toBe(src.indexOf("'openai'"));
  });

  it('is unknown with no-evaluable-files when everything is excluded', async () => {
    const out = await run({ 'node_modules/a/i.js': "require('openai');\n", 'dist/b.js': 'x' });
    expect(out.state).toBe('unknown');
    expect(out.notes).toEqual(['no-evaluable-files']);
  });

  it('excludes nested node_modules and matches extensions case-insensitively', async () => {
    const out = await run({ 'pkg/node_modules/x.ts': "import a from 'openai';\n", 'A.TS': "import a from 'openai';\n" });
    expect(out.findings.map((f) => f.evidence.path)).toEqual(['A.TS']);
  });
});

describe('evaluate: non-ok snapshot entries never pass', () => {
  it('reports a symlinked directory and a symlinked file as unknown', async () => {
    const outside = await makeRepo({ 'x.ts': "import a from 'openai';\n" });
    const dir = await makeRepo({ 'ok.ts': 'export const a = 1;\n' });
    await symlink(outside, path.join(dir, 'src'));
    await symlink(path.join(outside, 'x.ts'), path.join(dir, 'l.ts'));
    const out = await runDir(dir);
    expect(out.state).toBe('unknown');
    expect(out.unknownFiles).toEqual([
      { path: 'l.ts', reason: 'symlink' },
      { path: 'src', reason: 'symlink' },
    ]);
  });

  it('reports over-cap files as unknown, with or without an extension', async () => {
    const dir = await makeRepo({ 'big.ts': 'x'.repeat(50), 'Makefile': 'y'.repeat(50), 'ok.ts': '1' });
    const out = await runDir(dir, 10);
    expect(out.state).toBe('unknown');
    expect(out.unknownFiles).toEqual([
      { path: 'Makefile', reason: 'too-large' },
      { path: 'big.ts', reason: 'too-large' },
    ]);
  });

  it('reports an unreadable source file as unknown', async (ctx) => {
    if (process.getuid?.() === 0) return ctx.skip();
    const dir = await makeRepo({ 'a.ts': "import a from 'openai';\n", 'b.ts': '1' });
    await chmod(path.join(dir, 'a.ts'), 0o000);
    const out = await runDir(dir);
    await chmod(path.join(dir, 'a.ts'), 0o644);
    expect(out.state).toBe('unknown');
    expect(out.unknownFiles).toEqual([{ path: 'a.ts', reason: 'unreadable' }]);
  });

  it('reports a binary source file as unknown but ignores a binary image', async () => {
    const out = await run({ 'a.ts': 'abc\u0000def', 'img.png': 'abc\u0000def', 'ok.ts': '1' });
    expect(out.state).toBe('unknown');
    expect(out.unknownFiles).toEqual([{ path: 'a.ts', reason: 'unreadable' }]);
  });
});

describe('evaluate: embedding and unlisted source formats', () => {
  const exts = 'vue svelte astro mdx html htm ipynb c cc cpp h hpp scala dart ex exs sh bash zsh lua pl r jl clj m mm'.split(' ');
  for (const ext of exts) {
    it(`reports .${ext} as unsupported-language`, async () => {
      const out = await run({ [`f.${ext}`]: 'x', 'ok.ts': '1' });
      expect(out.unknownFiles).toEqual([{ path: `f.${ext}`, reason: 'unsupported-language' }]);
      expect(out.state).toBe('unknown');
    });
  }

  it('reports an uppercase unsupported extension', async () => {
    expect((await run({ 'F.VUE': 'x', 'ok.ts': '1' })).unknownFiles).toHaveLength(1);
  });

  it('reports an extensionless shebang script and ignores one without', async () => {
    const hit = await run({ deploy: '#!/usr/bin/env node\nrequire("openai")\n', 'ok.ts': '1' });
    expect(hit.unknownFiles).toEqual([{ path: 'deploy', reason: 'unsupported-language' }]);
    const miss = await run({ LICENSE: 'MIT\n', 'ok.ts': '1' });
    expect(miss.unknownFiles).toEqual([]);
    expect(miss.state).toBe('pass');
  });

  it('ignores md, json, yaml, env, css and images', async () => {
    const out = await run({ 'a.md': 'x', 'b.json': '{}', 'c.yaml': 'a: 1', '.env': 'A=1', 'd.css': 'a{}', 'e.png': 'x', 'ok.ts': '1' });
    expect(out.state).toBe('pass');
    expect(out.unknownFiles).toEqual([]);
  });
});

describe('evaluate: template literals with substitutions', () => {
  it('flags a provider URL or gateway prefix in the template head', async () => {
    expect((await run({ 'a.ts': 'fetch(`https://api.openai.com/v1/${p}`);\n' })).state).toBe('fail');
    expect((await run({ 'a.ts': 'gateway(`openai/${m}`);\n' })).state).toBe('fail');
  });

  it('does not flag heads that do not fix the host or prefix', async () => {
    expect((await run({ 'a.ts': 'fetch(`https://${host}/v1`);\n' })).state).toBe('pass');
    expect((await run({ 'a.ts': 'gateway(`openai${x}`);\n' })).state).toBe('pass');
    expect((await run({ 'a.ts': 'fetch(`https://api.openai.com${x}`);\n' })).state).toBe('pass');
    expect((await run({ 'a.ts': 'fetch(`https://example.com/${x}`);\n' })).state).toBe('pass');
  });
});

describe('evaluate: evidence line and excerpt', () => {
  it('keeps line and excerpt consistent when an earlier literal holds U+2028', async () => {
    const src = "const s = 'a\u2028b';\nimport o from 'openai';\n";
    const f = (await run({ 'a.ts': src })).findings[0];
    expect(f.evidence.excerpt).toBe("import o from 'openai';");
    expect(f.evidence.line).toBe(3);
  });
});

describe('evaluate: file types outside the source and ignorable sets (final review A1)', () => {
  for (const name of ['tools/call.ps1', 'src/x.es6', 'src/x.coffee', 'build.groovy', 'TOOLS/CALL.PS1', 'src/X.COFFEE', 'a.vue', 'b.svelte']) {
    it(`reports ${name} as unsupported-language`, async () => {
      const out = await run({ [name]: 'Invoke-RestMethod https://api.openai.com/v1/chat\n', 'ok.ts': '1' });
      expect(out.unknownFiles).toEqual([{ path: name, reason: 'unsupported-language' }]);
      expect(out.state).toBe('unknown');
    });
  }

  it('still analyzes an uppercase source extension such as .MJS', async () => {
    const out = await run({ 'x.MJS': "import OpenAI from 'openai';\n" });
    expect(out.state).toBe('fail');
    expect(out.unknownFiles).toEqual([]);
  });

  const IGNORABLE = (
    'md markdown txt rst json jsonc yaml yml toml ini cfg conf env lock log csv tsv xml svg png jpg jpeg gif webp avif ' +
    'ico bmp tiff woff woff2 ttf otf eot pdf zip gz tar tgz map css scss sass less sql graphql gql prisma mdc ' +
    'local example sample template dist ' +
    'wasm node so dll dylib exe bin jar class o a pyc db sqlite sqlite3 mp3 mp4 mov webm ogg wav flac avi psd icns heic'
  ).split(' ');
  it('keeps the ignorable set exactly as ruled', () => {
    expect([...IGNORABLE_EXT].sort()).toEqual(IGNORABLE.map((e) => `.${e}`).sort());
  });

  it('ignores every ignorable file type, whatever its content', async () => {
    const files: Record<string, string> = { 'ok.ts': '1' };
    for (const ext of IGNORABLE) {
      files[`f.${ext}`] = "import OpenAI from 'openai';\n";
      files[`G.${ext.toUpperCase()}`] = 'x';
    }
    const out = await run(files);
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('pass');
    expect(out.filesEvaluated).toBe(1);
  });

  it('ignores an over-cap image (1.5 MB at the default cap) and an over-cap ignorable file at a small cap', async () => {
    const big = await makeRepo({ 'logo.png': 'p'.repeat(1_500_000), 'ok.ts': '1' });
    const out = await runDir(big);
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('pass');
    const small = await makeRepo({ 'data.json': 'x'.repeat(50), 'ok.ts': '1' });
    expect((await runDir(small, 10)).state).toBe('pass');
  });

  it('ignores an unreadable ignorable file', async (ctx) => {
    if (process.getuid?.() === 0) return ctx.skip();
    const dir = await makeRepo({ 'notes.md': 'x', 'ok.ts': '1' });
    await chmod(path.join(dir, 'notes.md'), 0o000);
    const out = await runDir(dir);
    await chmod(path.join(dir, 'notes.md'), 0o644);
    expect(out.state).toBe('pass');
  });

  it('still reports a symlink named like an image as unknown', async () => {
    const dir = await makeRepo({ 'ok.ts': '1' });
    await symlink('/etc/hosts', path.join(dir, 'x.png'));
    const out = await runDir(dir);
    expect(out.unknownFiles).toEqual([{ path: 'x.png', reason: 'symlink' }]);
    expect(out.state).toBe('unknown');
  });

  it('ignores extensionless Makefile and LICENSE and .env.local', async () => {
    const out = await run({ Makefile: 'all:\n\tcurl https://api.openai.com\n', LICENSE: 'MIT\n', '.env.local': 'A=1\n', 'ok.ts': '1' });
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('pass');
  });

  it('reports an extensionless shebang script that starts with a BOM', async () => {
    const out = await run({ deploy: '﻿#!/bin/sh\ncurl https://api.openai.com\n', 'ok.ts': '1' });
    expect(out.unknownFiles).toEqual([{ path: 'deploy', reason: 'unsupported-language' }]);
  });

  it('ignores a binary file without a source extension but reports a binary source file', async () => {
    const out = await run({ 'blob.bin': 'a\u0000b', 'a.ts': 'a\u0000b', 'ok.ts': '1' });
    expect(out.unknownFiles).toEqual([{ path: 'a.ts', reason: 'unreadable' }]);
  });
});

describe('evaluate: declaration files and per-file failures (final review A2)', () => {
  for (const ext of ['d.ts', 'd.mts', 'd.cts']) {
    it(`evaluates a .${ext} file with a reference directive and declare module`, async () => {
      const src = '/// <reference types="next" />\ndeclare module \'openai\' { export const y: string; }\nexport const x: number;\n';
      const out = await run({ [`next-env.${ext}`]: src, 'ok.ts': '1' });
      expect(out.unknownFiles).toEqual([]);
      expect(out.state).toBe('pass');
      expect(out.filesEvaluated).toBe(2);
    });

    it(`flags an import('openai') type in a .${ext} file`, async () => {
      const out = await run({ [`t.${ext}`]: "export type T = import('openai').OpenAI;\n" });
      expect(out.state).toBe('fail');
      expect(out.findings[0].matched).toBe('openai');
    });
  }

  it('still reports a real syntax error in a declaration file', async () => {
    const out = await run({ 'x.d.ts': 'export const = ;\n' });
    expect(out.unknownFiles).toEqual([{ path: 'x.d.ts', reason: 'parse-error' }]);
  });

  it('turns an exception while scanning one file into an unknown entry for that file only', async () => {
    const snapshot = await takeSnapshot(
      await makeRepo({ 'a.ts': "import a from 'openai';\n", 'boom.ts': 'export const b = 1;\n' }),
      { skipDirs: card.exclusions.dirs },
    );
    const out = evaluate({ snapshot, card, allowlist: ['anthropic'] }, (filePath, ...rest) => {
      if (filePath === 'boom.ts') throw new Error('Debug Failure.');
      return scanFile(filePath, ...rest);
    });
    expect(out.unknownFiles).toEqual([{ path: 'boom.ts', reason: 'parse-error' }]);
    expect(out.findings).toHaveLength(1);
    expect(out.state).toBe('fail');
    expect(out.filesEvaluated).toBe(1);
  });
});

describe('evaluate: URL schemes and template heads (final review A3, A4)', () => {
  const flags = async (src: string) => (await run({ 'a.ts': src })).state;

  it('checks provider hosts under any scheme, a trailing dot and an uppercase host', async () => {
    expect(await flags("new WebSocket('wss://api.openai.com/v1/realtime');\n")).toBe('fail');
    expect(await flags("new WebSocket('ws://api.openai.com/v1/realtime');\n")).toBe('fail');
    expect(await flags("x('git+ssh://api.openai.com/repo');\n")).toBe('fail');
    expect(await flags("fetch('https://api.openai.com./v1/chat');\n")).toBe('fail');
    expect(await flags("fetch('HTTPS://API.OPENAI.COM/v1/chat');\n")).toBe('fail');
    expect(await flags("fetch('https://api.openai.com.evil.example/v1');\n")).toBe('pass');
    expect(await flags("fetch('https://api.openai.com../v1');\n")).toBe('pass');
  });

  it('flags a template URL whose head fixes the host and continues with ? or #', async () => {
    expect(await flags('fetch(`https://api.openai.com?key=${k}`);\n')).toBe('fail');
    expect(await flags('fetch(`https://api.openai.com#${k}`);\n')).toBe('fail');
    expect(await flags('new WebSocket(`wss://api.openai.com/v1/${p}`);\n')).toBe('fail');
  });

  it('leaves heads with an incomplete host unflagged', async () => {
    expect(await flags('fetch(`https://api.openai.com${p}`);\n')).toBe('pass');
    expect(await flags('fetch(`https://${h}/`);\n')).toBe('pass');
    expect(await flags('fetch(`https://api.openai.com:${port}/v1`);\n')).toBe('pass');
  });
});

describe('evaluate: require.resolve, import types and gateway case (final review A5)', () => {
  it('flags require.resolve of a provider package', async () => {
    const out = await run({ 'a.js': "const p = require.resolve('openai/package.json');\n" });
    expect(out.state).toBe('fail');
    expect(out.findings[0].matched).toBe('openai/package.json');
  });

  it('flags typeof import() and import().T type nodes', async () => {
    expect((await run({ 'a.ts': "type A = typeof import('@ai-sdk/openai');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "let c: import('openai').OpenAI;\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "type A = typeof import('@ai-sdk/anthropic');\n" })).state).toBe('pass');
  });

  it('compares gateway prefixes case-insensitively', async () => {
    expect((await run({ 'a.ts': "gateway('OpenAI/gpt-5');\n" })).state).toBe('fail');
    expect((await run({ 'a.ts': "gateway('ANTHROPIC/claude');\n" })).state).toBe('pass');
  });
});

describe('evaluate: binary entries never hide an unlisted language (re-review regression)', () => {
  for (const name of ['tools/call.sh', 'tools/call.py', 'tools/call.rb']) {
    it(`reports ${name} with a NUL byte in a comment as unreadable`, async () => {
      const out = await run({ [name]: 'echo hi\n# \u0000\ncurl https://api.openai.com/v1/chat\n', 'ok.ts': '1' });
      expect(out.unknownFiles).toEqual([{ path: name, reason: 'unreadable' }]);
      expect(out.state).toBe('unknown');
    });
  }

  for (const name of ['tools/call.ps1', 'tools/call.py']) {
    it(`reports UTF-16LE ${name} as unknown, never pass`, async () => {
      const dir = await makeRepo({ 'ok.ts': '1' });
      await mkdir(path.join(dir, 'tools'));
      await writeFile(path.join(dir, name), Buffer.from('Invoke-RestMethod https://api.openai.com/v1/chat\n', 'utf16le'));
      const out = await runDir(dir);
      expect(out.unknownFiles).toEqual([{ path: name, reason: 'unreadable' }]);
      expect(out.state).toBe('unknown');
    });
  }

  it('ignores binary .png, .wasm, .node and .mp4 files', async () => {
    const out = await run({ 'a.png': 'a\u0000b', 'b.wasm': 'a\u0000b', 'c.node': 'a\u0000b', 'd.mp4': 'a\u0000b', 'ok.ts': '1' });
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('pass');
  });

  it('ignores every ignorable type when its content is binary', async () => {
    const files: Record<string, string> = { 'ok.ts': '1' };
    for (const ext of IGNORABLE_EXT) files[`f${ext}`] = 'a\u0000b';
    const out = await run(files);
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('pass');
  });

  it('ignores a small extensionless binary but reports a large one as too-large', async () => {
    const small = await run({ blob: 'a\u0000b', 'ok.ts': '1' });
    expect(small.unknownFiles).toEqual([]);
    expect(small.state).toBe('pass');
    // Known conservative inconsistency: an over-cap extensionless file is never read, so it cannot be told apart from
    // a script and stays unknown, while the same file under the cap is seen as binary and skipped.
    const dir = await makeRepo({ blob: `a\u0000${'b'.repeat(50)}`, 'ok.ts': '1' });
    const big = await runDir(dir, 10);
    expect(big.unknownFiles).toEqual([{ path: 'blob', reason: 'too-large' }]);
  });

  it('keeps a binary .ts file unknown (unreadable)', async () => {
    const out = await run({ 'a.ts': 'a\u0000b', 'ok.ts': '1' });
    expect(out.unknownFiles).toEqual([{ path: 'a.ts', reason: 'unreadable' }]);
  });
});

describe('evaluate: model-identifier literals anywhere in source (real-repo gap, card 1.1.0)', () => {
  it('reports evaluator 0.4.0: JSX attribute strings no longer count towards the minified share (CURB-21)', () => {
    expect(EVALUATOR_VERSION).toBe('0.4.0');
  });

  const one = async (src: string, allowlist = ['anthropic'], name = 'a.ts') => run({ [name]: src }, allowlist);

  it('flags a model id inside an array of objects, with the literal reason text', async () => {
    const src = 'export const models = [\n  { id: "anthropic/claude-sonnet-4-5" },\n  { id: "openai/gpt-5-mini" },\n];\n';
    const out = await one(src);
    expect(out.state).toBe('fail');
    expect(out.findings).toHaveLength(1);
    const f = out.findings[0];
    expect(f.providerId).toBe('openai');
    expect(f.matched).toBe('openai/gpt-5-mini');
    expect(f.evidence.line).toBe(3);
    expect(f.evidence.start).toBe(src.indexOf('"openai/gpt-5-mini"'));
    expect(f.evidence.reason).toBe(
      'model identifier literal "openai/gpt-5-mini" resolves to provider "openai", which is not in the allowlist',
    );
  });

  it('flags a model id as an object property value, a default parameter and a variable initializer', async () => {
    expect((await one('const cfg = { model: "xai/grok-4.1-fast" };\n')).findings.map((f) => f.providerId)).toEqual(['xai']);
    expect((await one('export function pick(m = "deepseek/deepseek-v3.2") { return m; }\n')).findings.map((f) => f.providerId)).toEqual(['deepseek']);
    expect((await one('export const DEFAULT_MODEL = "moonshotai/kimi-k2.5";\n')).findings.map((f) => f.providerId)).toEqual(['moonshotai']);
  });

  it('flags a model id inside a satisfies or as const object', async () => {
    const src = 'type M = { id: string };\nexport const a = { id: "openai/gpt-5" } satisfies M;\nexport const b = { id: "mistral/mistral-large-2" } as const;\n';
    expect((await one(src)).findings.map((f) => f.matched)).toEqual(['openai/gpt-5', 'mistral/mistral-large-2']);
  });

  it('flags a model id as a JSX attribute value and as a no-substitution template', async () => {
    const jsx = 'export const C = () => <ModelPicker value="google/gemini-2.5-pro" />;\n';
    expect((await one(jsx, ['anthropic'], 'c.tsx')).findings.map((f) => f.providerId)).toEqual(['google']);
    expect((await one('export const m = `openai/gpt-5`;\n')).findings.map((f) => f.matched)).toEqual(['openai/gpt-5']);
  });

  it('matches the prefix and slug in any case', async () => {
    const out = await one('export const m = "OpenAI/GPT-5";\n');
    expect(out.findings.map((f) => `${f.providerId}:${f.matched}`)).toEqual(['openai:OpenAI/GPT-5']);
  });

  it('does not flag a model id of an allowed provider', async () => {
    const out = await one('export const m = "anthropic/claude-sonnet-4-5";\nexport const n = "openai/gpt-5";\n', ['anthropic', 'openai']);
    expect(out.state).toBe('pass');
  });

  it('does not flag slugs without a digit or hyphen, empty or nested slugs, or strings without a slash', async () => {
    const src = [
      'export const a = "google/fonts";',
      'export const b = "meta/robots";',
      'export const c = "openai/";',
      'export const d = "openai/gpt-5/extra";',
      'export const e = "openai";',
      'export const f = "gpt-5";',
      'export const g = "/openai/gpt-5";',
      'export const h = "unregistered/model-1";',
      '',
    ].join('\n');
    const out = await one(src);
    expect(out.findings).toEqual([]);
    expect(out.state).toBe('pass');
  });

  it('does not flag display-name maps, object keys, bare provider-name arrays or comments', async () => {
    const src = [
      'export const names = { openai: "OpenAI", xai: "xAI", deepseek: "DeepSeek" };',
      'export const byId = { "openai/gpt-5": 1, ["xai/grok-4"]: 2 };',
      'export const order = ["fireworks", "bedrock", "openai", "xai"];',
      '// fallback was "openai/gpt-5" once',
      '/* and "xai/grok-4" */',
      'interface P { "openai/gpt-5": string }',
      'const { "xai/grok-4": picked } = byId as Record<string, number>;',
      '',
    ].join('\n');
    const out = await one(src);
    expect(out.findings).toEqual([]);
    expect(out.state).toBe('pass');
  });

  it('reports a provider-package import once, by the package rule only', async () => {
    const out = await one('import x from "openai/resources";\nexport const y = require("@ai-sdk/openai/internal-2");\n');
    expect(out.findings.map((f) => f.evidence.reason.split(' "')[0])).toEqual(['import of package', 'load of package']);
  });

  it('does not treat module names as model ids', async () => {
    const src = [
      'export * from "xai/grok-4";',
      'export type T = typeof import("xai/grok-4");',
      'import r = require("xai/grok-4");',
      'declare module "xai/grok-4" { export const v: string; }',
      'const p = import("xai/grok-4");',
      'const q = require.resolve("xai/grok-4");',
      '',
    ].join('\n');
    const out = await one(src, ["anthropic"], "m.ts");
    expect(out.findings).toEqual([]);
  });

  it('keeps the declared-constructor check: same finding id, no duplicate, constructor reason wins', async () => {
    const src = "gateway('openai/gpt-5');\ngateway.languageModel('xai/x');\n";
    const out = await one(src);
    expect(out.findings).toHaveLength(2);
    expect(out.findings.map((f) => f.evidence.reason)).toEqual([
      'model identifier "openai/gpt-5" resolves to provider "openai", which is not in the allowlist',
      'model identifier "xai/x" resolves to provider "xai", which is not in the allowlist',
    ]);
    // the literal rule alone would find the first one at the same offset, so the id is unchanged
    const plain = await one("const m = 'openai/gpt-5';\n");
    expect(plain.findings[0].evidence.reason.startsWith('model identifier literal')).toBe(true);
  });

  it('flags a literal model id passed to an aliased constructor or a tagged template', async () => {
    const out = await one('const g = gateway;\ng("openai/gpt-5");\ngateway`xai/grok-4`;\n');
    expect(out.findings.map((f) => f.providerId)).toEqual(['openai', 'xai']);
  });

  it('flags the newly registered gateway prefixes', async () => {
    const prefixes = ['deepseek', 'moonshotai', 'meta', 'cohere', 'perplexity', 'alibaba', 'minimax', 'zai', 'amazon', 'nvidia'];
    const src = prefixes.map((p, i) => `export const m${i} = "${p}/model-${i}";`).join('\n') + '\n';
    const out = await one(src);
    expect(out.findings.map((f) => f.providerId)).toEqual(prefixes);
  });
});

describe('evaluate: minified heuristic by share of bytes in long lines', () => {
  const svgPath = `M${Array.from({ length: 260 }, (_, i) => `${i % 9}.5 ${i % 7}`).join('L')}Z`;

  it('evaluates an ordinary TSX file with one long SVG path line', async () => {
    const lines = ['export function Icon() {', '  return (', '    <svg viewBox="0 0 24 24">'];
    lines.push(`      <path d="${svgPath.padEnd(1300, '0').slice(0, 1300)}" />`);
    lines.push('    </svg>', '  );', '}', '');
    for (let i = 0; i < 110; i++) lines.push(`export const value${i} = ${i}; // ordinary line number ${i} of filler code`);
    const src = `${lines.join('\n')}\n`;
    expect(src.split('\n').filter((l) => l.length > 1000)).toHaveLength(1);
    const out = await run({ 'icons.tsx': src });
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('pass');
    expect(out.filesEvaluated).toBe(1);
  });

  it('reports a one-line 5,000-char file and a file of three 2,000-char lines as minified', async () => {
    const out = await run({
      'one.js': `var s="${'x'.repeat(4990)}";`,
      'three.js': [1, 2, 3].map((n) => `var s${n}="${'y'.repeat(1990)}";`).join('\n'),
    });
    expect(out.unknownFiles).toEqual([
      { path: 'one.js', reason: 'minified' },
      { path: 'three.js', reason: 'minified' },
    ]);
  });

  it('draws the line at more than half of the file bytes in long lines', async () => {
    const long = `var s="${'z'.repeat(1191)}";`; // 1,200 chars
    // n bytes of short comment lines (100 chars each), so only the first line is long
    const filler = (n: number) => {
      let f = '';
      while (n - f.length > 100) f += `//${'c'.repeat(97)}\n`;
      const r = n - f.length;
      return f + (r >= 2 ? `//${'c'.repeat(r - 2)}` : ' '.repeat(r));
    };
    // total = 1200 + 1 newline + filler
    const under = `${long}\n${filler(1200)}`; // 1200 of 2401 bytes
    const exact = `${long}\n${filler(1199)}`; // 1200 of 2400 bytes: not more than half
    const over = `${long}\n${filler(1198)}`; // 1200 of 2399 bytes
    expect([under.length, exact.length, over.length]).toEqual([2401, 2400, 2399]);
    expect(under.split('\n').filter((l) => l.length > 1000)).toHaveLength(1);
    const out = await run({ 'under.js': under, 'exact.js': exact, 'over.js': over });
    expect(out.unknownFiles).toEqual([{ path: 'over.js', reason: 'minified' }]);
  });

  it('still treats .min.js by name as minified and keeps the generated-header rule', async () => {
    const out = await run({ 'tiny.min.js': 'var a = 1;\n', 'gen.ts': '// Code generated, DO NOT EDIT\nexport const a = 1;\n', 'ok.ts': '1' });
    expect(out.unknownFiles).toEqual([
      { path: 'gen.ts', reason: 'generated' },
      { path: 'tiny.min.js', reason: 'minified' },
    ]);
  });
});

describe('evaluate: small SVG icon components are not minified (CURB-21)', () => {
  const pathData = (n: number) => `M${Array.from({ length: n }, (_, i) => `${i % 9}.5 ${i % 7}`).join('L')}Z`.padEnd(2900, '0').slice(0, 2900);
  const icon = (extra = '') =>
    ['export const Icon = () => (', '  <svg viewBox="0 0 24 24">', `    <path ${extra}d="${pathData(260)}" />`, '  </svg>', ');', ''].join('\n');

  it('evaluates a small icon whose single JSX d attribute holds most of the bytes', async () => {
    const src = icon();
    expect(src.split('\n').filter((l) => l.length > 1000)).toHaveLength(1);
    const out = await run({ 'openai-svg.tsx': src });
    expect(out.unknownFiles).toEqual([]);
    expect(out.state).toBe('pass');
    expect(out.filesEvaluated).toBe(1);
  });

  it('still finds a provider reference sitting in a JSX attribute of such an icon', async () => {
    const out = await run({ 'logo.tsx': icon('href="https://api.openai.com/v1" ') });
    expect(out.unknownFiles).toEqual([]);
    expect(out.findings.map((f) => f.providerId)).toEqual(['openai']);
  });

  it('keeps a .tsx file minified when its long lines are code, not JSX attribute strings', async () => {
    const three = [1, 2, 3].map((n) => `const s${n} = "${'y'.repeat(1990)}";`).join('\n');
    const packed = `export const x = <a d="short" />;${'a=1;'.repeat(600)}`;
    const out = await run({ 'three.tsx': three, 'packed.tsx': packed });
    expect(out.unknownFiles).toEqual([
      { path: 'packed.tsx', reason: 'minified' },
      { path: 'three.tsx', reason: 'minified' },
    ]);
  });

  it('does not exempt a long JSX attribute in a .js file or by name', async () => {
    const out = await run({ 'icon.js': icon(), 'vendor.min.js': 'var a=1;' });
    expect(out.unknownFiles.map((u) => u.path).sort()).toEqual(['icon.js', 'vendor.min.js']);
  });
});

describe('evaluate: registry entries added in card 1.1.0', () => {
  it('maps each new package and host to its provider id', async () => {
    const pkgs = {
      '@ai-sdk/deepseek': 'deepseek', '@ai-sdk/cohere': 'cohere', '@ai-sdk/perplexity': 'perplexity', '@ai-sdk/groq': 'groq',
      '@ai-sdk/amazon-bedrock': 'bedrock', '@aws-sdk/client-bedrock-runtime': 'bedrock', '@ai-sdk/fireworks': 'fireworks',
      '@ai-sdk/deepinfra': 'deepinfra', '@ai-sdk/togetherai': 'togetherai', '@ai-sdk/azure': 'azure',
    };
    const hosts = {
      'api.deepseek.com': 'deepseek', 'api.cohere.com': 'cohere', 'api.cohere.ai': 'cohere', 'api.perplexity.ai': 'perplexity',
      'api.groq.com': 'groq',
    };
    const src = [
      ...Object.keys(pkgs).map((p, i) => `import p${i} from '${p}';`),
      ...Object.keys(hosts).map((h) => `fetch('https://${h}/v1/x');`),
      '',
    ].join('\n');
    const out = await run({ 'a.ts': src });
    expect(out.findings.map((f) => f.providerId)).toEqual([...Object.values(pkgs), ...Object.values(hosts)]);
  });
});

describe('evaluate: registry entries added in card 1.2.0 (CURB-20)', () => {
  it('maps each new package and host to its provider id', async () => {
    const pkgs = { '@openrouter/ai-sdk-provider': 'openrouter', '@openrouter/sdk': 'openrouter', '@openrouter/agent': 'openrouter' };
    const hosts = {
      'openrouter.ai': 'openrouter', 'api.together.ai': 'togetherai', 'api.fireworks.ai': 'fireworks',
      'api.deepinfra.com': 'deepinfra', 'api.moonshot.ai': 'moonshotai',
    };
    const src = [
      ...Object.keys(pkgs).map((p, i) => `import p${i} from '${p}';`),
      ...Object.keys(hosts).map((h) => `fetch('https://${h}/v1/x');`),
      '',
    ].join('\n');
    const out = await run({ 'a.ts': src });
    expect(out.findings.map((f) => f.providerId)).toEqual([...Object.values(pkgs), ...Object.values(hosts)]);
  });

  it('flags an OpenRouter base URL held as an object property value, and passes once openrouter is allowed', async () => {
    const files = { 'route.ts': 'const client = { baseURL: "https://openrouter.ai/api/v1" };\n' };
    const blocked = await run(files);
    expect(blocked.state).toBe('fail');
    expect(blocked.findings.map((f) => f.providerId)).toEqual(['openrouter']);
    expect((await run(files, ['anthropic', 'openrouter'])).state).toBe('pass');
  });

  it('does not flag look-alike hosts for the new entries', async () => {
    const out = await run({
      'a.ts': [
        "fetch('https://openrouter.ai.evil.example/x');",
        "fetch('https://notopenrouter.ai/x');",
        "fetch('https://api.together.ai.example/x');",
        "const doc = 'see openrouter.ai for details';",
        '',
      ].join('\n'),
    });
    expect(out.findings).toEqual([]);
    expect(out.state).toBe('pass');
  });
});
