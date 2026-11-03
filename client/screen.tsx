import { useTranslation, type PluginScreenProps } from "@getpaseo/plugin/client";
import { useMemo, useState } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { combinedCredits, type QuotaBucket, type QuotaSite, type QuotaSiteState } from "../shared/quota";
import { useQuotaActions, useQuotaState, useUpdateCheck } from "./data";
import { formatDate, formatNumber, formatTime, percentageOf } from "./format";
import { translations } from "./i18n";

const INTERVALS = [
  { minutes: 0, label: "screen.intervalOff" },
  { minutes: 5, label: "screen.interval5" },
  { minutes: 15, label: "screen.interval15" },
  { minutes: 30, label: "screen.interval30" },
  { minutes: 60, label: "screen.interval60" },
  { minutes: 360, label: "screen.interval360" },
  { minutes: 1440, label: "screen.interval1440" },
] as const;

function bucketShare(bucket: QuotaBucket): number {
  const percentage = percentageOf(bucket.percentage);
  if (percentage !== null) return percentage;
  const total = bucket.total ?? (bucket.used !== null && bucket.remaining !== null ? bucket.used + bucket.remaining : null);
  if (!total || !bucket.used) return 0;
  return Math.max(0, Math.min(100, (bucket.used / total) * 100));
}

export function QoderUsageScreen({ theme, layout }: PluginScreenProps) {
  const compact = layout.compact;
  const query = useQuotaState();
  const actions = useQuotaActions();
  const [refreshingSites, setRefreshingSites] = useState<Record<string, boolean>>({});
  const [changingInterval, setChangingInterval] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const updateQuery = useUpdateCheck();
  const { t } = useTranslation(translations);

  const siteLabel = (site: QuotaSite): string => t(site === "qoder-cn" ? "screen.siteCn" : "screen.siteGlobal");

  const bucketText = (bucket: QuotaBucket): string => {
    const total = bucket.total ?? (bucket.used !== null && bucket.remaining !== null ? bucket.used + bucket.remaining : null);
    const percentage = percentageOf(bucket.percentage);
    const used = formatNumber(bucket.used);
    const totalText = formatNumber(total);
    return percentage !== null
      ? t("screen.valuePercent", { used, total: totalText, percent: Math.round(percentage) })
      : t("screen.value", { used, total: totalText });
  };

  const styles = useMemo(
    () =>
      ({
        screen: { flex: 1, backgroundColor: theme.colors.surface0 },
        content: { padding: compact ? 14 : 20, gap: compact ? 14 : 16, paddingBottom: 48 },
        headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
        title: { fontSize: 18, fontWeight: "700", color: theme.colors.foreground },
        subtitle: { fontSize: 11, color: theme.colors.foregroundMuted },
        button: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.surface1 },
        buttonText: { fontSize: 12, color: theme.colors.foreground },
        banner: { borderRadius: 10, padding: 10, backgroundColor: theme.colors.surface1 },
        bannerError: { borderLeftWidth: 3, borderLeftColor: theme.colors.statusDanger },
        bannerText: { fontSize: 11, color: theme.colors.foreground },
        updateBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: theme.colors.surface2,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        updateText: { flex: 1, fontSize: 11, color: theme.colors.foreground, lineHeight: 16 },
        updateDismiss: { paddingHorizontal: 4, paddingVertical: 2 },
        updateDismissText: { fontSize: 12, color: theme.colors.foregroundMuted },
        section: { backgroundColor: theme.colors.surface1, borderRadius: 10, padding: 12, gap: 10 },
        sectionTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.foreground },
        siteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
        siteName: { fontSize: 14, fontWeight: "700", color: theme.colors.foreground },
        planLine: { fontSize: 11, color: theme.colors.foregroundMuted },
        bucketRow: { gap: 6 },
        bucketHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
        bucketLabel: { fontSize: 12, color: theme.colors.foreground },
        bucketValue: { fontSize: 12, color: theme.colors.foregroundMuted },
        barTrack: { height: 6, borderRadius: 3, backgroundColor: theme.colors.surface0, overflow: "hidden", flexDirection: "row" },
        footer: { fontSize: 10, color: theme.colors.foregroundMuted },
        errorText: { fontSize: 11, color: theme.colors.statusDanger },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
        chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.colors.surface0 },
        chipActive: { backgroundColor: theme.colors.accent },
        chipText: { fontSize: 11, color: theme.colors.foregroundMuted },
        chipTextActive: { color: theme.colors.accentForeground },
        installButton: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.accent },
        installButtonText: { fontSize: 12, color: theme.colors.accentForeground, fontWeight: "600" },
      }) satisfies Record<string, ViewStyle | TextStyle>,
    [theme, compact],
  );

  const data = query.data;
  const sites = data?.sites ?? [];
  const intervalMinutes = data?.intervalMinutes ?? 30;
  const needsInstall = data?.needsInstall === true;

  const refreshSite = async (site: QuotaSite) => {
    if (refreshingSites[site] || installing) return;
    setRefreshingSites((current) => ({ ...current, [site]: true }));
    try {
      await actions.refresh({ site });
      await query.refetch();
    } finally {
      setRefreshingSites((current) => {
        const next = { ...current };
        delete next[site];
        return next;
      });
    }
  };

  const changeInterval = async (minutes: number) => {
    if (changingInterval) return;
    setChangingInterval(true);
    try {
      await actions.setIntervalMinutes({ intervalMinutes: minutes });
      await query.refetch();
    } finally {
      setChangingInterval(false);
    }
  };

  const installNow = async () => {
    if (installing) return;
    setInstalling(true);
    try {
      await actions.installSdk({});
      await query.refetch();
    } finally {
      setInstalling(false);
    }
  };

  const toneFor = (percentage: number | null): string =>
    percentage !== null && percentage >= 95
      ? theme.colors.statusDanger
      : percentage !== null && percentage >= 80
        ? theme.colors.statusWarning
        : theme.colors.accent;

  const renderBucket = (label: string, bucket: QuotaBucket | null) => {
    if (!bucket) return null;
    const share = bucketShare(bucket);
    const tone = toneFor(share);
    return (
      <View key={label} style={styles.bucketRow}>
        <View style={styles.bucketHeader}>
          <Text style={styles.bucketLabel}>{label}</Text>
          <Text style={styles.bucketValue}>{bucketText(bucket)}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={{ flex: Math.max(1, Math.round(share)), backgroundColor: tone }} />
          {share < 100 ? <View style={{ flex: Math.max(1, Math.round(100 - share)) }} /> : null}
        </View>
      </View>
    );
  };

  const renderSite = (state: QuotaSiteState) => {
    const { site, snapshot, fetching } = state;
    const refreshing = refreshingSites[site] === true || fetching;
    const combined = combinedCredits(snapshot);
    const combinedShare = combined && combined.total > 0 ? (combined.used / combined.total) * 100 : null;
    const combinedBucket: QuotaBucket | null = combined
      ? {
          used: combined.used,
          remaining: Math.max(0, combined.total - combined.used),
          total: combined.total,
          percentage: combinedShare,
          unit: combined.unit,
        }
      : null;
    const buckets: Array<{ labelKey: "screen.bucketPlan" | "screen.bucketAddOn" | "screen.bucketOrg"; bucket: QuotaBucket }> = [
      { labelKey: "screen.bucketPlan", bucket: snapshot.userQuota },
      { labelKey: "screen.bucketAddOn", bucket: snapshot.addOnQuota },
      { labelKey: "screen.bucketOrg", bucket: snapshot.orgResourcePackage },
    ].filter(
      (item): item is { labelKey: "screen.bucketPlan" | "screen.bucketAddOn" | "screen.bucketOrg"; bucket: QuotaBucket } =>
        Boolean(item.bucket),
    );
    const exhausted = combinedShare !== null ? combinedShare >= 100 : snapshot.isQuotaExceeded === true;
    const hasData = Boolean(snapshot.fetchedAt);

    return (
      <View key={site} style={styles.section}>
        <View style={styles.siteHeader}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={styles.siteName}>{siteLabel(site)}</Text>
            <Text style={styles.planLine}>
              {hasData
                ? `${t("screen.plan", { type: snapshot.userType ?? "—" })}${
                    snapshot.expiresAt ? t("screen.expires", { date: formatDate(snapshot.expiresAt) }) : ""
                  }`
                : refreshing
                  ? t("screen.readingAccount")
                  : t("screen.waitingAccount")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("screen.refreshLabel", { site: siteLabel(site) })}
            disabled={refreshing || installing}
            style={styles.button}
            onPress={() => void refreshSite(site)}
          >
            <Text style={styles.buttonText}>{refreshing ? t("screen.refreshing") : t("screen.refresh")}</Text>
          </Pressable>
        </View>

        {snapshot.error ? (
          <View style={[styles.banner, styles.bannerError]}>
            <Text style={styles.bannerText}>{snapshot.error}</Text>
          </View>
        ) : null}

        {hasData ? (
          <>
            {combinedBucket ? renderBucket(t("screen.bucketTotal"), combinedBucket) : null}
            {combinedBucket && buckets.length === 1
              ? null
              : buckets.map((item) => renderBucket(t(item.labelKey), item.bucket))}
            {combinedBucket && buckets.length > 1 ? <Text style={styles.footer}>{t("screen.totalHint")}</Text> : null}
            {site === "qoder-cn" && snapshot.orgResourcePackage && !snapshot.userQuota ? (
              <Text style={styles.footer}>{t("screen.enterpriseHint")}</Text>
            ) : null}
            {exhausted ? <Text style={styles.errorText}>{t("screen.exhausted")}</Text> : null}
            <Text style={styles.footer}>
              {t("screen.official")}
              {snapshot.fetchedAt ? t("screen.updated", { time: formatTime(snapshot.fetchedAt) }) : ""}
            </Text>
          </>
        ) : !snapshot.error ? (
          <Text style={styles.footer}>{refreshing ? t("screen.fetching") : t("screen.noQuota")}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={styles.title}>{t("screen.title")}</Text>
            <Text style={styles.subtitle}>{t("screen.subtitle")}</Text>
          </View>
        </View>

        {updateQuery.data?.updateAvailable && !updateDismissed ? (
          <View style={styles.updateBanner}>
            <Text style={styles.updateText}>
              {t("screen.update", {
                latest: updateQuery.data.latestVersion,
                current: updateQuery.data.currentVersion,
                command: "paseo plugin update qoder-usage",
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("screen.dismiss")}
              onPress={() => setUpdateDismissed(true)}
              style={styles.updateDismiss}
            >
              <Text style={styles.updateDismissText}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {needsInstall ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("screen.installTitle")}</Text>
            <Text style={styles.footer}>{t("screen.installBody")}</Text>
            <Pressable style={styles.installButton} disabled={installing} onPress={() => void installNow()}>
              <Text style={styles.installButtonText}>{installing ? t("screen.installing") : t("screen.installAction")}</Text>
            </Pressable>
            <Text style={styles.footer}>{t("screen.installHint")}</Text>
          </View>
        ) : null}

        {sites.length === 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("screen.noAccountTitle")}</Text>
            <Text style={styles.footer}>{t("screen.noAccountBody")}</Text>
          </View>
        ) : (
          sites.map(renderSite)
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("screen.autoRefresh")}</Text>
          <View style={styles.chipRow}>
            {INTERVALS.map((item) => {
              const active = item.minutes === intervalMinutes;
              return (
                <Pressable
                  key={item.minutes}
                  disabled={changingInterval}
                  onPress={() => void changeInterval(item.minutes)}
                  style={active ? [styles.chip, styles.chipActive] : styles.chip}
                >
                  <Text style={active ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{t(item.label)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.footer}>{t("screen.autoRefreshHint")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
