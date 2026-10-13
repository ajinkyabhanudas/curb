// engine/test/evaluator.test.ts
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
  });
});
