import { gateway } from "ai";

export function getLanguageModel(modelId: string) {
  return gateway.languageModel(modelId);
}
