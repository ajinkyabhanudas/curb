import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export const chatModel = openai('gpt-4o');
export const titleModel = anthropic('claude-haiku-4-5');
