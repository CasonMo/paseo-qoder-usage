import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { combinedCredits, type QuotaSite, type QuotaSnapshot, type QuotaState } from "../shared/quota";
import { pluginDataDir } from "./paths";
import { detectAvailableSites, emptySnapshot, fetchQuota } from "./quota";

const CONFIG_FILE = "config.json";
const DEFAULT_INTERVAL_MINUTES = 30;
const MAX_INTERVAL_MINUTES = 1440;

interface SiteState {
  site: QuotaSite;
  snapshot: QuotaSnapshot;
  fetching: boolean;
  fetchPromise: Promise<void> | null;
}

export interface QoderUsageService {
  get(): Promise<QuotaState>;
  refresh(site?: QuotaSite): Promise<QuotaState>;
  setIntervalMinutes(minutes: number): Promise<QuotaState>;
  installSdk(): Promise<QuotaState>;
  stop(): void;
}

export function createQoderUsageService(): QoderUsageService {
  const dir = pluginDataDir();
  let intervalMinutes = DEFAULT_INTERVAL_MINUTES;
  let needsInstall = false;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const states = new Map<QuotaSite, SiteState>();

  for (const site of detectAvailableSites()) {
    states.set(site, {
      site,
      snapshot: { ...emptySnapshot(null), site },
      fetching: false,
      fetchPromise: null,
    });
  }

  function syncAvailableSites(): void {
    const available = detectAvailableSites();
    for (const site of available) {
      if (!states.has(site)) {
        states.set(site, {
          site,
          snapshot: { ...emptySnapshot(null), site },
          fetching: false,
          fetchPromise: null,
        });
      }
    }
    const keep = new Set(available);
    for (const site of [...states.keys()]) {
      if (!keep.has(site)) states.delete(site);
    }
  }

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
      void refreshAll();
    }, intervalMinutes * 60_000);
    timer.unref?.();
  }

  async function refreshSite(site: QuotaSite, install = false): Promise<void> {
    if (stopped) return;
    const state = states.get(site);
    if (!state) return;
    if (state.fetchPromise) return state.fetchPromise;

    state.fetching = true;
    state.fetchPromise = (async () => {
      try {
        const result = await fetchQuota(dir, { install, site });
        if (result.ok) {
          needsInstall = false;
          state.snapshot = result.snapshot;
          const combined = combinedCredits(result.snapshot);
          console.log(`[qoder-usage] ${site} quota: ${combined ? `${combined.used}/${combined.total}` : "?"} credits`);
        } else {
          if (result.needsInstall) needsInstall = true;
          state.snapshot = { ...state.snapshot, ok: false, error: result.error, site };
          if (result.needsInstall) {
            console.log(`[qoder-usage] ${site} SDK not installed; waiting for explicit user confirmation`);
          } else {
            console.warn(`[qoder-usage] ${site} quota fetch failed: ${result.error}`);
          }
        }
      } finally {
        state.fetching = false;
      }
    })();

    try {
      await state.fetchPromise;
    } finally {
      state.fetchPromise = null;
    }
  }

  async function refreshAll(install = false): Promise<void> {
    for (const site of [...states.keys()]) {
      await refreshSite(site, install);
    }
  }

  async function get(): Promise<QuotaState> {
    await loaded;
    syncAvailableSites();
    return {
      sites: [...states.values()].map(({ site, snapshot, fetching }) => ({ site, snapshot, fetching })),
      intervalMinutes,
      needsInstall,
    };
  }

  async function refresh(site?: QuotaSite): Promise<QuotaState> {
    await loaded;
    syncAvailableSites();
    if (site) await refreshSite(site, false);
    else await refreshAll(false);
    return get();
  }

  async function installSdk(): Promise<QuotaState> {
    await loaded;
    syncAvailableSites();
    await refreshAll(true);
    return get();
  }

  async function setIntervalMinutes(minutes: number): Promise<QuotaState> {
    await loaded;
    intervalMinutes = Math.min(MAX_INTERVAL_MINUTES, Math.max(0, Math.round(minutes)));
    await saveConfig().catch((error) => console.error("[qoder-usage] config save failed", error));
    schedule();
    if (intervalMinutes > 0) void refreshAll();
    return get();
  }

  function stop(): void {
    stopped = true;
    if (timer) clearInterval(timer);
    timer = null;
  }

  void loaded.then(() => {
    schedule();
    const stale = [...states.values()].some((state) => {
      const at = state.snapshot.fetchedAt;
      return !at || (intervalMinutes > 0 && Date.now() - at > intervalMinutes * 60_000);
    });
    if (!stopped && stale) void refreshAll();
  });

  return { get, refresh, setIntervalMinutes, installSdk, stop };
}
