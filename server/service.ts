import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { QuotaSnapshot, QuotaState } from "../shared/quota";
import { pluginDataDir } from "./paths";
import { emptySnapshot, fetchQuota } from "./quota";

const CONFIG_FILE = "config.json";
const DEFAULT_INTERVAL_MINUTES = 30;
const MAX_INTERVAL_MINUTES = 1440;

export interface QoderUsageService {
  get(): Promise<QuotaState>;
  refresh(): Promise<QuotaState>;
  setIntervalMinutes(minutes: number): Promise<QuotaState>;
  installSdk(): Promise<QuotaState>;
  stop(): void;
}

export function createQoderUsageService(): QoderUsageService {
  const dir = pluginDataDir();
  let snapshot: QuotaSnapshot = emptySnapshot(null);
  let intervalMinutes = DEFAULT_INTERVAL_MINUTES;
  let fetching = false;
  let needsInstall = false;
  let fetchPromise: Promise<void> | null = null;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const loaded = (async () => {
    try {
      const parsed = JSON.parse(await readFile(join(dir, CONFIG_FILE), "utf8")) as { intervalMinutes?: unknown };
      if (typeof parsed?.intervalMinutes === "number" && Number.isFinite(parsed.intervalMinutes) && parsed.intervalMinutes >= 0) {
        intervalMinutes = Math.min(MAX_INTERVAL_MINUTES, Math.round(parsed.intervalMinutes));
      }
    } catch {
      /* defaults */
    }
  })();

  async function saveConfig(): Promise<void> {
    await mkdir(dir, { recursive: true, mode: 0o700 }).catch(() => {});
    const file = join(dir, CONFIG_FILE);
    const temporary = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`;
    await writeFile(temporary, JSON.stringify({ intervalMinutes }, null, 2), { mode: 0o600 });
    await rename(temporary, file);
  }

  function schedule(): void {
    if (timer) clearInterval(timer);
    timer = null;
    if (stopped || intervalMinutes === 0) return;
    timer = setInterval(() => {
      void refreshOnce();
    }, intervalMinutes * 60_000);
    timer.unref?.();
  }

  async function refreshOnce(install = false): Promise<void> {
    if (stopped) return;
    if (fetchPromise) return fetchPromise;
    fetchPromise = (async () => {
      fetching = true;
      try {
        const result = await fetchQuota(dir, { install });
        if (result.ok) {
          needsInstall = false;
          snapshot = result.snapshot;
          console.log(`[qoder-usage] quota: ${snapshot.userQuota?.used ?? "?"}/${snapshot.userQuota?.total ?? "?"} credits`);
        } else {
          needsInstall = result.needsInstall === true;
          snapshot = { ...snapshot, ok: false, error: result.error };
          if (needsInstall) console.log("[qoder-usage] SDK not installed; waiting for explicit user confirmation");
          else console.warn(`[qoder-usage] quota fetch failed: ${result.error}`);
        }
      } finally {
        fetching = false;
      }
    })();
    try {
      await fetchPromise;
    } finally {
      fetchPromise = null;
    }
  }

  async function get(): Promise<QuotaState> {
    await loaded;
    return { snapshot, intervalMinutes, fetching, needsInstall };
  }

  async function refresh(): Promise<QuotaState> {
    await loaded;
    await refreshOnce(false);
    return get();
  }

  async function installSdk(): Promise<QuotaState> {
    await loaded;
    await refreshOnce(true);
    return get();
  }

  async function setIntervalMinutes(minutes: number): Promise<QuotaState> {
    await loaded;
    intervalMinutes = Math.min(MAX_INTERVAL_MINUTES, Math.max(0, Math.round(minutes)));
    await saveConfig().catch((error) => console.error("[qoder-usage] config save failed", error));
    schedule();
    if (intervalMinutes > 0) void refreshOnce();
    return get();
  }

  function stop(): void {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  }

  void loaded.then(() => {
    schedule();
    const stale = !snapshot.fetchedAt || (intervalMinutes > 0 && Date.now() - (snapshot.fetchedAt ?? 0) > intervalMinutes * 60_000);
    if (!stopped && stale) void refreshOnce();
  });

  return { get, refresh, setIntervalMinutes, installSdk, stop };
}
