import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { confirmObligation, locateQuote, type Applicability } from '../src/obligation/obligation.ts';
import { loadCard } from '../src/policy/card.ts';
import { ObligationNotActiveError, runScan } from '../src/scan.ts';
import { exitCodeFor, recordRefusal, scanAndRecord } from '../src/workflow.ts';
import { CARD_PATH, QUOTE, ROOT, confirmFixture, fixtureDeps, makeRepo, scanFixture } from './helpers.ts';

describe('workflow on the mutated fixture', () => {
  it('produces a fail with one finding at providers.ts line 2 and records an audit trail', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const file = await scanFixture(deps, confirmed, 'mutated');
    expect(file.body.state).toBe('fail');
    expect(file.body.findings).toHaveLength(1);
    expect(file.body.findings[0].evidence.path).toBe('lib/ai/providers.ts');
    expect(file.body.findings[0].evidence.line).toBe(2);
    expect(file.body.filesEvaluated).toBe(2);
    expect(file.envelope.resultHash).toMatch(/^[0-9a-f]{64}$/);
    const types = (await deps.audit.list(deps.ctx)).map((e) => e.type);
    expect(types).toEqual(['obligation.confirmed', 'scan.completed']);
    expect(await deps.audit.verify(deps.ctx)).toBe(true);
  });

  it('gives the same result hash on a second run', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const a = await scanFixture(deps, confirmed, 'mutated');
    const b = await scanFixture(deps, confirmed, 'mutated');
    expect(b.envelope.resultHash).toBe(a.envelope.resultHash);
  });
});

describe('runScan gates', () => {
  async function setup(applicability: Applicability) {
    const { card, hash } = await loadCard(CARD_PATH);
    const agreement = ingestAgreement(`# A\n\n${QUOTE}\n`);
    const obligation = confirmObligation(
      {
        agreementTextSha256: agreement.textSha256,
        quote: QUOTE,
        range: locateQuote(agreement.text, QUOTE),
        policyCardId: card.id,
        policyCardVersion: card.version,
        applicability,
        allowlist: applicability === 'applies' ? ['anthropic'] : [],
        approver: 'Test Reviewer',
        approvedAt: '2026-10-13T09:00:00.000Z',
      },
      agreement,
      card,
    );
    const repoPath = await makeRepo({ 'a.ts': "import x from 'openai';\n" });
    return { input: { repoPath, card, cardHash: hash, agreement, obligation } };
  }

  it('refuses needs-counsel and unsupported obligations', async () => {
    for (const a of ['needs-counsel', 'unsupported'] as const) {
      const { input } = await setup(a);
      await expect(runScan(input)).rejects.toBeInstanceOf(ObligationNotActiveError);
    }
  });

  it('returns not-applicable only from a human not-applicable record', async () => {
    const { input } = await setup('not-applicable');
    const { body } = await runScan(input);
    expect(body.state).toBe('not-applicable');
    expect(body.findings).toEqual([]);
  });

  it('refuses a tampered obligation', async () => {
    const { input } = await setup('applies');
    const tampered = { ...input.obligation, allowlist: ['openai'] };
    await expect(runScan({ ...input, obligation: tampered })).rejects.toThrow(/does not match its content/);
  });

  it('refuses an agreement that differs from the one confirmed', async () => {
    const { input } = await setup('applies');
    await expect(runScan({ ...input, agreement: ingestAgreement('# Other\n') })).rejects.toThrow(/agreement/);
  });

  // Guards a false pass (CURB-46): runScan checks the card itself, not only the earlier confirmObligation check.
  it('refuses an obligation that was confirmed against another version or id of the card', async () => {
    const { input } = await setup('applies');
    const agreement = input.agreement;
    const confirmAgainst = (card: typeof input.card) =>
      confirmObligation(
        {
          agreementTextSha256: agreement.textSha256,
          quote: QUOTE,
          range: locateQuote(agreement.text, QUOTE),
          policyCardId: card.id,
          policyCardVersion: card.version,
          applicability: 'applies',
          allowlist: ['anthropic'],
          approver: 'Test Reviewer',
          approvedAt: '2026-10-13T09:00:00.000Z',
        },
        agreement,
        card,
      );
    const otherVersion = confirmAgainst({ ...input.card, version: '9.9.9' });
    await expect(runScan({ ...input, obligation: otherVersion })).rejects.toThrow(/different policy card or version/);
    const otherId = confirmAgainst({ ...input.card, id: 'some-other-rule' });
    await expect(runScan({ ...input, obligation: otherId })).rejects.toThrow(/different policy card or version/);
  });

  it('returns error, not pass, when the evaluator throws', async () => {
    const { input } = await setup('applies');
    const { body } = await runScan(input, () => {
      throw new Error('boom');
    });
    expect(body.state).toBe('error');
    expect(body.notes).toEqual(['evaluator-exception']);
  });

  it('does not touch the network during a scan', async () => {
    const { input } = await setup('applies');
    const require = createRequire(import.meta.url);
    const net = require('node:net');
    const http = require('node:http');
    const https = require('node:https');
    const dns = require('node:dns');
    const guard = () => {
      throw new Error('network access attempted');
    };
    const originals = {
      connect: net.Socket.prototype.connect,
      httpRequest: http.request,
      httpsRequest: https.request,
      lookup: dns.lookup,
    };
    net.Socket.prototype.connect = guard;
    http.request = guard;
    https.request = guard;
    dns.lookup = guard;
    try {
      const { body } = await runScan(input);
      expect(body.state).toBe('fail');
    } finally {
      net.Socket.prototype.connect = originals.connect;
      http.request = originals.httpRequest;
      https.request = originals.httpsRequest;
      dns.lookup = originals.lookup;
    }
  });
});

describe('recording failures', () => {
  const failing = (what: string) => ({
    append: async () => {
      throw new Error(what);
    },
    list: async () => [],
    verify: async () => true,
  });

  async function refusedSetup() {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const needsCounsel = { ...confirmed.obligation, applicability: 'needs-counsel' as const };
    return { deps, confirmed, needsCounsel };
  }

  it('rethrows the original refusal when the audit append also fails', async () => {
    const { deps, confirmed } = await refusedSetup();
    const { card, hash } = await loadCard(CARD_PATH);
    const agreement = ingestAgreement(confirmed.agreementRaw);
    const ob = confirmObligation(
      {
        agreementTextSha256: agreement.textSha256,
        quote: QUOTE,
        range: locateQuote(agreement.text, QUOTE),
        policyCardId: card.id,
        policyCardVersion: card.version,
        applicability: 'needs-counsel',
        allowlist: [],
        approver: 'T',
        approvedAt: '2026-10-13T09:00:00.000Z',
      },
      agreement,
      card,
    );
    const broken = { ...deps, audit: failing('disk full') };
    await expect(
      scanAndRecord(broken, { repoPath: '.', agreementRaw: confirmed.agreementRaw, card, cardHash: hash, obligation: ob }),
    ).rejects.toBeInstanceOf(ObligationNotActiveError);
  });

  it('recordRefusal never throws and keeps data plain', async () => {
    const deps = await fixtureDeps();
    await recordRefusal({ ...deps, audit: failing('nope') }, { id: 'x' }, 'r');
    await recordRefusal(deps, { id: 'a'.repeat(64) }, 'z'.repeat(500));
    await recordRefusal(deps, { id: 'short' }, 'no id');
    const entries = await deps.audit.list(deps.ctx);
    expect(entries.map((e) => e.type)).toEqual(['scan.refused', 'scan.refused']);
    expect(entries[0].data).toEqual({ reason: 'z'.repeat(200), obligationId: 'a'.repeat(64) });
    expect(entries[1].data).toEqual({ reason: 'no id' });
  });

  it('fails closed with the result hash when the blob store fails', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const broken = {
      ...deps,
      blobs: {
        put: async (): Promise<string> => {
          throw new Error('blob boom');
        },
        get: async () => null,
      },
    };
    await expect(scanFixture(broken, confirmed, 'mutated')).rejects.toThrow(
      /scan completed with result sha256:[0-9a-f]{64} but recording failed: blob boom/,
    );
  });

  it('fails closed with the result hash when the scan.completed append fails', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const broken = { ...deps, audit: failing('audit boom') };
    await expect(scanFixture(broken, confirmed, 'mutated')).rejects.toThrow(
      /scan completed with result sha256:[0-9a-f]{64} but recording failed: audit boom/,
    );
  });
});

describe('diagnostics, exit codes and determinism', () => {
  it('surfaces a swallowed evaluator exception as diagnostics, outside the hashed body', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const file = await scanAndRecord(
      deps,
      {
        repoPath: path.join(ROOT, 'fixtures/repos/mutated'),
        agreementRaw: confirmed.agreementRaw,
        card: confirmed.card,
        cardHash: confirmed.cardHash,
        obligation: confirmed.obligation,
      },
      () => {
        throw new Error('kaboom');
      },
    );
    expect(file.body.state).toBe('error');
    expect(file.diagnostics).toEqual(['Error: kaboom']);
    expect(JSON.stringify(file.body)).not.toContain('kaboom');
  });

  it('maps only the error state to exit code 3', () => {
    for (const s of ['pass', 'fail', 'unknown', 'not-applicable'] as const) expect(exitCodeFor(s)).toBe(0);
    expect(exitCodeFor('error')).toBe(3);
  });

  it('gives the same result hash for a different actor and clock', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const a = await scanFixture(deps, confirmed, 'mutated');
    const other = {
      ...deps,
      ctx: { ...deps.ctx, actor: 'someone-else' },
      now: () => new Date('2030-01-01T00:00:00.000Z'),
    };
    const b = await scanFixture(other, confirmed, 'mutated');
    expect(b.envelope.resultHash).toBe(a.envelope.resultHash);
    expect(b.envelope.operator).toBe('someone-else');
  });
});

describe('.git in the report exclusions (final review A7)', () => {
  it('lists dir:.git and never analyzes a source file under a nested .git directory', async () => {
    const deps = await fixtureDeps();
    const confirmed = await confirmFixture(deps);
    const repoPath = await makeRepo({
      'ok.ts': 'export const a = 1;\n',
      'sub/.git/hooks/x.ts': "import o from 'openai';\n",
      '.git/y.ts': "import o from 'openai';\n",
    });
    const file = await scanAndRecord(deps, { repoPath, ...confirmed });
    expect(file.body.exclusions).toContain('dir:.git');
    expect(file.body.exclusions).toEqual([...file.body.exclusions].sort());
    expect(file.body.state).toBe('pass');
    expect(file.body.filesEvaluated).toBe(1);
  });
});
