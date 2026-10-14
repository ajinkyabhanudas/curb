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
    expect(registryProviderIds(card)).toEqual(['anthropic', 'google', 'mistral', 'openai', 'xai']);
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

  it('ships version 1.0.1, and any change to patterns, non-claims or registry changes the hash (final review A6)', async () => {
    const { card, hash } = await loadCard(CARD_PATH);
    expect(card.version).toBe('1.0.1');
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
});
