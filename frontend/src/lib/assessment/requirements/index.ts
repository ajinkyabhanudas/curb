import type { Requirement } from "../types";
import { euAiAct } from "./eu-ai-act";
import { gdpr } from "./gdpr";
import { iso42001 } from "./iso-42001";
import { nistAiRmf } from "./nist-ai-rmf";

export const REQUIREMENTS: Requirement[] = [...euAiAct, ...gdpr, ...nistAiRmf, ...iso42001];
