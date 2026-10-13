// engine/test/card.test.ts
import { describe, expect, it } from 'vitest';
import { loadCard, own, registryProviderIds, validateCard } from '../src/policy/card.ts';
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
});
