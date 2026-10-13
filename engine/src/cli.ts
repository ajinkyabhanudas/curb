#!/usr/bin/env node
// engine/src/cli.ts
import { access, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ingestAgreement } from './agreement/ingest.ts';
import { loadCard } from './policy/card.ts';
import { parseObligation, type Applicability } from './obligation/obligation.ts';
import { FsAuditLog, FsBlobStore } from './store/fs.ts';
import { renderMarkdown } from './report/markdown.ts';
import { parseResultFile, verifyResultIntegrity } from './schema/result.ts';
import { safeText } from './terminal.ts';
import { confirmAndRecord, exitCodeFor, recordRefusal, scanAndRecord, type Deps } from './workflow.ts';

type Values = Record<string, string | boolean | undefined>;

function need(values: Values, name: string): string {
  const v = values[name];
  if (typeof v !== 'string' || v === '') throw new Error(`missing required option --${name}`);
  return v;
}

function makeDeps(values: Values, actor: string): Deps {
  const store = String(values.store ?? '.curb');
  return {
    ctx: { tenantId: String(values.tenant ?? 'demo'), actor },
    blobs: new FsBlobStore(store),
    audit: new FsAuditLog(store),
  };
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function checkOut(out: unknown, force: unknown): Promise<void> {
  if (typeof out === 'string' && force !== true && (await exists(out))) {
    throw new Error(`--out file already exists: ${out} (pass --force to overwrite)`);
  }
}

async function writeOut(out: string, text: string, force: unknown): Promise<void> {
  await writeFile(out, text, { flag: force === true ? 'w' : 'wx' });
}

async function output(text: string, out: unknown, force: unknown): Promise<void> {
  if (typeof out === 'string') await writeOut(out, text, force);
  else process.stdout.write(text);
}

/** Resolve a path through symlinks as far as it exists, then append the rest. */
async function resolveReal(p: string): Promise<string> {
  const abs = path.resolve(p);
  const rest: string[] = [];
  let cur = abs;
  for (;;) {
    try {
      return path.join(await realpath(cur), ...rest);
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      rest.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

async function assertStoreOutsideRepo(store: string, repo: string): Promise<void> {
  const s = await resolveReal(store);
  const r = await resolveReal(repo);
  const rel = path.relative(r, s);
  if (rel === '' || (!(rel === '..' || rel.startsWith(`..${path.sep}`)) && !path.isAbsolute(rel))) {
    throw new Error(`--store (${store}) is inside the scanned repo (${repo}); pass --store outside the repo`);
  }
}

function parseStart(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(n)) throw new Error(`option --start must be a non-negative integer, got "${raw}"`);
  return n;
}

async function confirm(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      agreement: { type: 'string' }, card: { type: 'string' }, quote: { type: 'string' }, start: { type: 'string' },
      applicability: { type: 'string', default: 'applies' }, allow: { type: 'string', default: '' },
      approver: { type: 'string' }, at: { type: 'string' }, exception: { type: 'string' },
      out: { type: 'string' }, store: { type: 'string' }, tenant: { type: 'string' }, force: { type: 'boolean' },
    },
  });
  const approver = need(values, 'approver');
  const start = parseStart(values.start);
  await checkOut(values.out, values.force);
  const { card } = await loadCard(need(values, 'card'));
  const obligation = await confirmAndRecord(
    makeDeps(values, approver),
    await readFile(need(values, 'agreement')),
    card,
    {
      quote: need(values, 'quote'),
      start,
      applicability: String(values.applicability) as Applicability,
      allowlist: String(values.allow).split(',').map((s) => s.trim()).filter(Boolean),
      approver,
      approvedAt: values.at ?? new Date().toISOString(),
      exception: values.exception,
    },
  );
  await output(`${JSON.stringify(obligation, null, 2)}\n`, values.out, values.force);
}

async function scan(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: 'string' }, card: { type: 'string' }, agreement: { type: 'string' },
      obligation: { type: 'string' }, out: { type: 'string' }, store: { type: 'string' },
      tenant: { type: 'string' }, actor: { type: 'string', default: 'cli' }, force: { type: 'boolean' },
    },
  });
  const repo = need(values, 'repo');
  const store = String(values.store ?? '.curb');
  await assertStoreOutsideRepo(store, repo);
  await checkOut(values.out, values.force);
  const deps = makeDeps(values, String(values.actor));
  let raw: unknown;
  let prepared;
  try {
    const { card, hash } = await loadCard(need(values, 'card'));
    const agreementRaw = await readFile(need(values, 'agreement'));
    raw = JSON.parse(await readFile(need(values, 'obligation'), 'utf8'));
    prepared = { card, hash, agreementRaw, obligation: parseObligation(raw, ingestAgreement(agreementRaw), card) };
  } catch (e) {
    await recordRefusal(deps, raw, e instanceof Error ? e.message : String(e));
    throw e;
  }
  const { card, hash, agreementRaw, obligation } = prepared;
  const { diagnostics, ...file } = await scanAndRecord(deps, {
    repoPath: repo,
    agreementRaw,
    card,
    cardHash: hash,
    obligation,
  });
  const { body, envelope } = file;
  const lines = [
    `${body.state.toUpperCase()}  ${body.findings.length} finding(s), ${body.unknownFiles.length} unknown file(s), ${body.filesEvaluated} file(s) evaluated`,
    ...body.findings.map((f) =>
      safeText(`  ${f.evidence.path}:${f.evidence.line}:${f.evidence.column}  ${f.providerId}  ${f.evidence.excerpt}`),
    ),
    ...body.unknownFiles.map((u) => safeText(`  unknown: ${u.path} (${u.reason})`)),
    `policy card status: ${safeText(card.status)}`,
    `store: ${safeText(path.resolve(store))}  tenant: ${safeText(deps.ctx.tenantId)}`,
    `result sha256:${envelope.resultHash}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  for (const d of diagnostics) process.stderr.write(`curb: diagnostic: ${safeText(d)}\n`);
  if (typeof values.out === 'string') await writeOut(values.out, `${JSON.stringify(file, null, 2)}\n`, values.force);
  return exitCodeFor(body.state);
}

async function report(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      result: { type: 'string' }, card: { type: 'string' }, agreement: { type: 'string' }, obligation: { type: 'string' },
      format: { type: 'string', default: 'md' }, out: { type: 'string' }, force: { type: 'boolean' },
    },
  });
  if (values.format !== 'md' && values.format !== 'json') throw new Error(`--format must be md or json, got "${values.format}"`);
  await checkOut(values.out, values.force);
  const file = parseResultFile(JSON.parse(await readFile(need(values, 'result'), 'utf8')));
  verifyResultIntegrity(file);
  const { card, hash } = await loadCard(need(values, 'card'));
  const agreement = ingestAgreement(await readFile(need(values, 'agreement')));
  const obligation = parseObligation(JSON.parse(await readFile(need(values, 'obligation'), 'utf8')), agreement, card);
  const expected: Record<string, string> = {
    obligationHash: obligation.id,
    agreementHash: agreement.textSha256,
    ruleId: card.id,
    ruleVersion: card.version,
    policyCardHash: hash,
  };
  for (const [field, want] of Object.entries(expected)) {
    const got = (file.body as unknown as Record<string, unknown>)[field];
    if (got !== want) {
      throw new Error(`result ${field} (${safeText(String(got))}) does not match the supplied inputs (${want}); refusing to report`);
    }
  }
  const text = values.format === 'json' ? `${JSON.stringify(file, null, 2)}\n` : renderMarkdown({ file, card, obligation });
  await output(text, values.out, values.force);
}

const COMMANDS: Record<string, (args: string[]) => Promise<number | void>> = { confirm, scan, report };

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const handler = command === undefined ? undefined : Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!handler) throw new Error(`usage: curb <${Object.keys(COMMANDS).join('|')}> [options]`);
  process.exitCode = (await handler(rest)) ?? 0;
}

main().catch((e: unknown) => {
  process.stderr.write(`curb: ${safeText(e instanceof Error ? e.message : String(e))}\n`);
  process.exit(2);
});
