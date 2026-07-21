import { NativeProvider } from "../base";

export class ClaudeProvider extends NativeProvider {
  readonly id = "claude" as const;
  readonly name = "Claude Code";
  readonly type = "subscription" as const;
}
