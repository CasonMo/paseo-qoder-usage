import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useMemo, useState } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { QuotaBucket } from "../shared/quota";
import { useQuotaActions, useQuotaState, useUpdateCheck } from "./data";
import { formatDate, formatNumber, formatTime } from "./format";

const INTERVALS: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: "关闭" },
  { minutes: 5, label: "5 分钟" },
  { minutes: 15, label: "15 分钟" },
  { minutes: 30, label: "30 分钟" },
  { minutes: 60, label: "1 小时" },
  { minutes: 360, label: "6 小时" },
  { minutes: 1440, label: "24 小时" },
];

function bucketText(bucket: QuotaBucket): string {
  const total = bucket.total ?? (bucket.used !== null && bucket.remaining !== null ? bucket.used + bucket.remaining : null);
  return `${formatNumber(bucket.used)} / ${formatNumber(total)}${bucket.percentage !== null ? `（${Math.round(bucket.percentage)}%）` : ""}`;
}

function bucketShare(bucket: QuotaBucket): number {
  if (bucket.percentage !== null) return Math.max(0, Math.min(100, bucket.percentage));
  const total = bucket.total ?? (bucket.used !== null && bucket.remaining !== null ? bucket.used + bucket.remaining : null);
  if (!total || !bucket.used) return 0;
  return Math.max(0, Math.min(100, (bucket.used / total) * 100));
}

export function QoderUsageScreen({ theme, layout }: PluginScreenProps) {
  const compact = layout.compact;
  const query = useQuotaState();
  const actions = useQuotaActions();
  const [busy, setBusy] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const updateQuery = useUpdateCheck();
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
  const snapshot = data?.snapshot;
  const intervalMinutes = data?.intervalMinutes ?? 30;
  const percentage = snapshot?.userQuota?.percentage ?? snapshot?.totalUsagePercentage ?? null;
  const tone =
    percentage !== null && percentage >= 95
      ? theme.colors.statusDanger
      : percentage !== null && percentage >= 80
        ? theme.colors.statusWarning
        : theme.colors.accent;
  const hasData = Boolean(snapshot?.fetchedAt);

  const refreshNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.refresh({});
      await query.refetch();
    } finally {
      setBusy(false);
    }
  };

  const changeInterval = async (minutes: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.setIntervalMinutes({ intervalMinutes: minutes });
      await query.refetch();
    } finally {
      setBusy(false);
    }
  };

  const needsInstall = data?.needsInstall === true;
  const installNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.installSdk({});
      await query.refetch();
    } finally {
      setBusy(false);
    }
  };

  const renderBucket = (label: string, bucket: QuotaBucket | null) => {
    if (!bucket) return null;
    const share = bucketShare(bucket);
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text style={styles.title}>Qoder 额度</Text>
            <Text style={styles.subtitle}>官方账号口径（Credits，覆盖所有客户端）</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="刷新额度" style={styles.button} onPress={() => void refreshNow()}>
            <Text style={styles.buttonText}>{busy || data?.fetching ? "刷新中…" : "刷新"}</Text>
          </Pressable>
        </View>

        {updateQuery.data?.updateAvailable && !updateDismissed ? (
          <View style={styles.updateBanner}>
            <Text style={styles.updateText}>
              发现新版本 v{updateQuery.data.latestVersion}（当前 v{updateQuery.data.currentVersion}）· 更新：paseo plugin update qoder-usage
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={() => setUpdateDismissed(true)} style={styles.updateDismiss}>
              <Text style={styles.updateDismissText}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {needsInstall ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>需要安装 Qoder SDK</Text>
            <Text style={styles.footer}>
              读取额度需要下载 Qoder Agent SDK（来自 npm registry，约 1MB，依赖树由随包锁文件固定）。在你确认之前不会进行任何下载。
            </Text>
            <Pressable style={styles.installButton} disabled={busy} onPress={() => void installNow()}>
              <Text style={styles.installButtonText}>{busy ? "安装中…" : "下载并安装"}</Text>
            </Pressable>
            <Text style={styles.footer}>不安装也可以继续使用 Paseo，这里只影响额度显示。</Text>
          </View>
        ) : null}

        {snapshot?.error && !needsInstall ? (
          <View style={[styles.banner, styles.bannerError]}>
            <Text style={styles.bannerText}>{snapshot.error}</Text>
          </View>
        ) : null}

        {!needsInstall && !hasData && !snapshot?.error ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{data?.fetching ? "正在获取额度…" : "加载中…"}</Text>
            <Text style={styles.footer}>首次约 10 秒（需要启动本机 qodercli）；数据缓存在本机。</Text>
          </View>
        ) : null}

        {hasData ? (
          <View style={styles.section}>
            <Text style={styles.planLine}>
              Plan：{snapshot?.userType ?? "—"}
              {snapshot?.expiresAt ? ` · 到期 ${formatDate(snapshot.expiresAt)}` : ""}
            </Text>
            {renderBucket("Plan Credits", snapshot?.userQuota ?? null)}
            {renderBucket("Add-on Credits", snapshot?.addOnQuota ?? null)}
            {renderBucket("Org Resource Package", snapshot?.orgResourcePackage ?? null)}
            {snapshot?.isQuotaExceeded ? <Text style={styles.errorText}>额度已用尽，请及时充值或升级</Text> : null}
            <Text style={styles.footer}>
              官方口径：账号计费周期 Credits（覆盖所有客户端）
              {snapshot?.fetchedAt ? ` · 更新于 ${formatTime(snapshot.fetchedAt)}` : ""}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>自动更新</Text>
          <View style={styles.chipRow}>
            {INTERVALS.map((item) => {
              const active = item.minutes === intervalMinutes;
              return (
                <Pressable
                  key={item.minutes}
                  disabled={busy}
                  onPress={() => void changeInterval(item.minutes)}
                  style={active ? [styles.chip, styles.chipActive] : styles.chip}
                >
                  <Text style={active ? [styles.chipText, styles.chipTextActive] : styles.chipText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.footer}>每隔所选时间在后台自动获取一次额度；「关闭」后仅手动刷新。设置保存在本机。</Text>
        </View>
      </ScrollView>
    </View>
  );
}
