import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createQoderUsageService } from "./server/service";
import { checkForUpdate } from "./server/update-check";
import { qoderConfigSetRpc, qoderQuotaGetRpc, qoderQuotaRefreshRpc, qoderSdkInstallRpc, qoderUpdateCheckRpc } from "./shared/quota";

export default function contribute(server: PluginServerContext) {
  const service = createQoderUsageService();
  server.handle(qoderQuotaGetRpc, () => service.get());
  server.handle(qoderQuotaRefreshRpc, (input) => service.refresh(input.site));
  server.handle(qoderSdkInstallRpc, () => service.installSdk());
  server.handle(qoderConfigSetRpc, (input) => service.setIntervalMinutes(input.intervalMinutes));
  server.handle(qoderUpdateCheckRpc, () => checkForUpdate());
  return () => service.stop();
}
