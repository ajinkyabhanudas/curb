import { streamText, gateway } from 'ai';
import { chatModel } from '@/lib/ai/providers';

// We evaluated openai('gpt-4o') early on; this comment must not trigger a finding.
const openai = 'just a variable name, not a provider reference';

export async function POST(request: Request) {
  const { messages } = await request.json();
  const result = streamText({ model: chatModel, messages });
  const fallback = gateway('anthropic/claude-sonnet-4-5');
  return result.toTextStreamResponse({ headers: { 'x-fallback': String(Boolean(fallback)), 'x-note': openai } });
}
