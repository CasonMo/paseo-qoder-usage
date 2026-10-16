import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createQoderUsageService } from "./server/service";
import { qoderConfigSetRpc, qoderQuotaGetRpc, qoderQuotaRefreshRpc, qoderSdkInstallRpc } from "./shared/quota";

export default function contribute(server: PluginServerContext) {
  const service = createQoderUsageService();
  server.handle(qoderQuotaGetRpc, () => service.get());
  server.handle(qoderQuotaRefreshRpc, () => service.refresh());
  server.handle(qoderSdkInstallRpc, () => service.installSdk());
  server.handle(qoderConfigSetRpc, (input) => service.setIntervalMinutes(input.intervalMinutes));
  return () => service.stop();
}
