// engine/test/evaluator.test.ts
import { chmod, symlink } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { evaluate } from '../src/evaluator/evaluate.ts';
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
