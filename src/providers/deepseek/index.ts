import { NativeProvider } from "../base";

export class DeepSeekProvider extends NativeProvider {
  readonly id = "deepseek" as const;
  readonly name = "DeepSeek API";
  readonly type = "api" as const;
}
