// engine/test/card.test.ts
import { describe, expect, it } from 'vitest';
import { loadCard, own, registryProviderIds, validateCard } from '../src/policy/card.ts';
import { hashOf } from '../src/schema/hashing.ts';
import { CARD_PATH } from './helpers.ts';

describe('policy card', () => {
  it('loads the shipped card with a stable hash and a draft status', async () => {
    const a = await loadCard(CARD_PATH);
    const b = await loadCard(CARD_PATH);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.card.status).toMatch(/draft/);
  });

  it('lists normalized provider ids from the registry', async () => {
    const { card } = await loadCard(CARD_PATH);
    expect(registryProviderIds(card)).toEqual([
      'alibaba', 'amazon', 'anthropic', 'azure', 'bedrock', 'cohere', 'deepinfra', 'deepseek', 'fireworks', 'google',
      'groq', 'meta', 'minimax', 'mistral', 'moonshotai', 'nvidia', 'openai', 'openrouter', 'perplexity', 'togetherai', 'xai',
      'zai',
    ]);
  });

  it('rejects a card with a missing registry', async () => {
    const { card } = await loadCard(CARD_PATH);
    const broken: Record<string, unknown> = { ...card };
    delete broken.registry;
    expect(() => validateCard(broken)).toThrow(/registry/);
  });

  it('rejects an unknown severity', async () => {
    const { card } = await loadCard(CARD_PATH);
    expect(() => validateCard({ ...card, severity: 'catastrophic' })).toThrow(/severity/);
  });

  it('own() ignores inherited properties', () => {
    expect(own({ a: 'x' }, 'a')).toBe('x');
    expect(own({ a: 'x' }, 'constructor')).toBeUndefined();
    expect(own({ a: 'x' }, '__proto__')).toBeUndefined();
  });

  it('ships version 1.3.0, and any change to patterns, non-claims or registry changes the hash (final review A6)', async () => {
    const { card, hash } = await loadCard(CARD_PATH);
    expect(card.version).toBe('1.3.0');
    expect(card.status).toBe('draft, pending counsel approval');
    const edits: ((c: typeof card) => void)[] = [
      (c) => c.approvedTextPatterns.push('extra'),
      (c) => (c.approvedTextPatterns[0] += ' '),
      (c) => c.nonClaims.pop(),
      (c) => (c.nonClaims[0] = 'changed'),
      (c) => (c.registry.packages.newpkg = 'openai'),
      (c) => (c.registry.hosts['api.openai.com'] = 'anthropic'),
      (c) => delete c.registry.gatewayPrefixes.xai,
    ];
    for (const edit of edits) {
      const copy = structuredClone(card);
      edit(copy);
      expect(hashOf(copy)).not.toBe(hash);
    }
  });

  it('1.3.0 describes provider property values and catalog files, and discloses their limits', async () => {
    const { card } = await loadCard(CARD_PATH);
    expect(card.interpretation).toMatch(/provider-named target/);
    expect(card.prerequisites.join('\n')).toMatch(/catalog/);
    expect(card.falsePositiveExamples.join('\n')).toMatch(/signInWithOAuth/);
    const risks = card.falseNegativeRisks.join('\n');
    expect(risks).toMatch(/shorthand \{ provider \}/);
    expect(risks).toMatch(/comparisons/);
    expect(risks).toMatch(/formatting change alone/);
    expect(card.falsePositiveExamples.join('\n')).toMatch(/AuthButton/);
    expect(risks).toMatch(/Bare model ids without a provider prefix/);
    expect(risks).toMatch(/single real repository/);
  });

  it('1.2.0 discloses how OpenRouter is treated and which hosts are not registered', async () => {
    const { card } = await loadCard(CARD_PATH);
    const risks = card.falseNegativeRisks.join('\n');
    expect(risks).toMatch(/OpenRouter .*own provider id/);
    expect(risks).toMatch(/api\.together\.xyz/);
    expect(risks).toMatch(/per-region subdomains/);
    expect(card.registry.hosts['openrouter.ai']).toBe('openrouter');
  });

  it('1.1.0 describes model-identifier literals and discloses what they still miss', async () => {
    const { card } = await loadCard(CARD_PATH);
    expect(card.interpretation).toMatch(/model[- ]identifier literal/i);
    const risks = card.falseNegativeRisks.join('\n');
    expect(risks).not.toMatch(/^Model identifiers held in variables or environment files$/m);
    expect(risks).toMatch(/assembled at runtime/);
    expect(risks).toMatch(/gatewayOrder/);
    expect(risks).toMatch(/providerOptions/);
    expect(risks).toMatch(/display-name maps/);
    expect(risks).toMatch(/without a digit or hyphen/);
    expect(risks).toMatch(/providers not in the registry/i);
    expect(risks).toMatch(/ai-gateway\.vercel\.sh/);
    for (const [prefix, id] of Object.entries(card.registry.gatewayPrefixes)) expect(id).toBe(prefix);
  });
});
