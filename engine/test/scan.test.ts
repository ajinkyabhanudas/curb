import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ingestAgreement } from '../src/agreement/ingest.ts';
import { confirmObligation, locateQuote, type Applicability } from '../src/obligation/obligation.ts';
import { loadCard } from '../src/policy/card.ts';
import { ObligationNotActiveError, runScan } from '../src/scan.ts';
import { CARD_PATH, QUOTE, confirmFixture, fixtureDeps, makeRepo, scanFixture } from './helpers.ts';

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
