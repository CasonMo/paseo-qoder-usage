import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { Text } from "react-native";
import type { QuotaBucket } from "../shared/quota";
import { useQuotaState } from "./data";

function bucketValue(bucket: QuotaBucket | null | undefined): string | null {
  if (!bucket) return null;
  if (bucket.used !== null && bucket.total !== null) return `${bucket.used}/${bucket.total}`;
  if (bucket.percentage !== null) return `${Math.round(bucket.percentage)}%`;
  return null;
}

export function QoderUsageSidebarItem({ currentScreen, openScreen, theme }: PluginSidebarItemProps) {
  const query = useQuotaState();
  const snapshot = query.data?.snapshot;
  const parts = [bucketValue(snapshot?.userQuota), bucketValue(snapshot?.orgResourcePackage)].filter(
    (value): value is string => Boolean(value),
  );
  const pending = parts.length === 0 && (query.data?.fetching === true || !snapshot?.fetchedAt);
  const trailing = parts.length > 0 ? parts.join(",") : pending ? "…" : null;
  return (
    <SidebarRow
      icon="Activity"
      label="Qoder 额度"
      active={currentScreen?.screenId === "quota"}
      trailing={trailing ? <Text style={{ fontSize: 11, color: theme.colors.foregroundMuted }}>{trailing}</Text> : undefined}
      onPress={() => openScreen({ screenId: "quota" })}
    />
  );
}
