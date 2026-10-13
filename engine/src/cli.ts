#!/usr/bin/env node
// engine/src/cli.ts
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ingestAgreement } from './agreement/ingest.ts';
import { loadCard } from './policy/card.ts';
import { parseObligation, type Applicability } from './obligation/obligation.ts';
import { FsAuditLog, FsBlobStore } from './store/fs.ts';
import { confirmAndRecord, scanAndRecord, type Deps } from './workflow.ts';

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

async function output(text: string, out: unknown): Promise<void> {
  if (typeof out === 'string') await writeFile(out, text);
  else process.stdout.write(text);
}

function parseStart(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(n)) throw new Error(`option --start must be an integer, got "${raw}"`);
  return n;
}

async function confirm(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      agreement: { type: 'string' }, card: { type: 'string' }, quote: { type: 'string' }, start: { type: 'string' },
      applicability: { type: 'string', default: 'applies' }, allow: { type: 'string', default: '' },
      approver: { type: 'string' }, at: { type: 'string' }, exception: { type: 'string' },
      out: { type: 'string' }, store: { type: 'string' }, tenant: { type: 'string' },
    },
  });
  const approver = need(values, 'approver');
  const start = parseStart(values.start);
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
  await output(`${JSON.stringify(obligation, null, 2)}\n`, values.out);
}

async function scan(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      repo: { type: 'string' }, card: { type: 'string' }, agreement: { type: 'string' },
      obligation: { type: 'string' }, out: { type: 'string' }, store: { type: 'string' },
      tenant: { type: 'string' }, actor: { type: 'string', default: 'cli' },
    },
  });
  const { card, hash } = await loadCard(need(values, 'card'));
  const agreementRaw = await readFile(need(values, 'agreement'));
  const raw: unknown = JSON.parse(await readFile(need(values, 'obligation'), 'utf8'));
  const obligation = parseObligation(raw, ingestAgreement(agreementRaw), card);
  const file = await scanAndRecord(makeDeps(values, String(values.actor)), {
    repoPath: need(values, 'repo'),
    agreementRaw,
    card,
    cardHash: hash,
    obligation,
  });
  const { body, envelope } = file;
  const lines = [
    `${body.state.toUpperCase()}  ${body.findings.length} finding(s), ${body.unknownFiles.length} unknown file(s), ${body.filesEvaluated} file(s) evaluated`,
    ...body.findings.map((f) => `  ${f.evidence.path}:${f.evidence.line}:${f.evidence.column}  ${f.providerId}  ${f.evidence.excerpt}`),
    ...body.unknownFiles.map((u) => `  unknown: ${u.path} (${u.reason})`),
    `policy card status: ${card.status}`,
    `result sha256:${envelope.resultHash}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  if (typeof values.out === 'string') await writeFile(values.out, `${JSON.stringify(file, null, 2)}\n`);
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = { confirm, scan };

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const handler = command === undefined ? undefined : Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
  if (!handler) throw new Error(`usage: curb <${Object.keys(COMMANDS).join('|')}> [options]`);
  await handler(rest);
}

main().catch((e: unknown) => {
  process.stderr.write(`curb: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(2);
});
