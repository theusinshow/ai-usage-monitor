import { NativeProvider } from "../base";

export class CodexProvider extends NativeProvider {
  readonly id = "codex" as const;
  readonly name = "Codex";
  readonly type = "subscription" as const;
}
