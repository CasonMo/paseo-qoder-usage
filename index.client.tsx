import type { PluginClientContext } from "@getpaseo/plugin/client";
import { QoderUsageScreen } from "./client/screen";
import { QoderUsageSidebarItem } from "./client/sidebar";

export default function contribute(client: PluginClientContext) {
  const cleanups = [
    client.addScreen({ id: "quota", title: "Qoder 额度", Component: QoderUsageScreen }),
    client.addSidebarFooterItem({ id: "quota", title: "Qoder 额度", Component: QoderUsageSidebarItem }),
  ];
  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        /* the host is tearing down already */
      }
    }
  };
}
