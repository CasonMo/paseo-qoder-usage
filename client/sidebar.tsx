import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { Text } from "react-native";
import { combinedCredits, type QuotaSnapshot } from "../shared/quota";
import { useQuotaState } from "./data";
import { formatNumber, percentageOf } from "./format";
import { QODER_USAGE_ICON } from "./icons";

function totalValue(snapshot: QuotaSnapshot): string | null {
  const combined = combinedCredits(snapshot);
  if (combined) return `${formatNumber(combined.used)}/${formatNumber(combined.total)}`;
  const percentage = percentageOf(
    snapshot.totalUsagePercentage ??
      snapshot.userQuota?.percentage ??
      snapshot.addOnQuota?.percentage ??
      snapshot.orgResourcePackage?.percentage ??
      null,
  );
  return percentage !== null ? `${Math.round(percentage)}%` : null;
}

export function QoderUsageSidebarItem({ currentScreen, openScreen, theme }: PluginSidebarItemProps) {
  const query = useQuotaState();
  const sites = query.data?.sites ?? [];
  const parts = sites
    .map(({ site, snapshot }) => {
      const value = totalValue(snapshot);
      if (!value) return null;
      const prefix = sites.length > 1 ? (site === "qoder-cn" ? "CN " : "Qoder ") : "";
      return `${prefix}${value}`;
    })
    .filter((value): value is string => Boolean(value));
  const pending = parts.length === 0 && (sites.some((site) => site.fetching) || sites.some((site) => !site.snapshot.fetchedAt));
  const trailing = parts.length > 0 ? parts.join(" · ") : pending ? "…" : null;
  const label = sites.length === 1 && sites[0]?.site === "qoder-cn" ? "Qoder CN 额度" : "Qoder 额度";
  return (
    <SidebarRow
      icon={{ svg: QODER_USAGE_ICON }}
      label={label}
      active={currentScreen?.screenId === "quota"}
      trailing={trailing ? <Text style={{ fontSize: 11, color: theme.colors.foregroundMuted }}>{trailing}</Text> : undefined}
      onPress={() => openScreen({ screenId: "quota" })}
    />
  );
}
