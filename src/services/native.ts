import { invoke } from "@tauri-apps/api/core";

export const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

export async function nativeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error("O backend Tauri não está disponível nesta visualização.");
  }
  return invoke<T>(command, args);
}
