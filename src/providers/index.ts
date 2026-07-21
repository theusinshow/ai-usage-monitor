import type { AIProvider } from "../types/provider";
import { ClaudeProvider } from "./claude";
import { CodexProvider } from "./codex";
import { DeepSeekProvider } from "./deepseek";
import { OpenAIProvider } from "./openai";

export const providers: AIProvider[] = [
  new CodexProvider(),
  new ClaudeProvider(),
  new DeepSeekProvider(),
  new OpenAIProvider(),
];
