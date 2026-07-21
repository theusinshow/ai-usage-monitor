import { nativeInvoke } from "../../services/native";

export interface OpenUsageReport {
  report: "daily" | "weekly" | "monthly" | "blocks";
  payload: unknown;
}

export class OpenUsageAdapter {
  isAvailable(): Promise<boolean> {
    return nativeInvoke<boolean>("is_openusage_available").catch(() => false);
  }

  run(report: OpenUsageReport["report"]): Promise<OpenUsageReport> {
    return nativeInvoke<OpenUsageReport>("run_openusage_report", { report });
  }
}
