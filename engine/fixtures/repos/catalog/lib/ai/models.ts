// Synthetic fixture: a model catalog whose ids reach the gateway through a variable.
export type CatalogModel = {
  id: string;
  name: string;
};

export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4-5';

export const catalog: CatalogModel[] = [
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 mini' },
  { id: 'xai/grok-4.1-fast', name: 'Grok fast' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek' },
];
