import { NativeProvider } from "../base";

export class OpenAIProvider extends NativeProvider {
  readonly id = "openai" as const;
  readonly name = "OpenAI API";
  readonly type = "api" as const;
}
