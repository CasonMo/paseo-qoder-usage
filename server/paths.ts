import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export function resolvePaseoHome(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const raw = env.PASEO_HOME?.trim();
  const fallback = join(home, ".paseo");
  if (!raw) return fallback;
  if (raw === "~") return home;
  if (raw.startsWith("~/")) return resolve(home, raw.slice(2));
  if (isAbsolute(raw)) return resolve(raw);
  return fallback;
}

export function pluginDataDir(): string {
  return join(resolvePaseoHome(), "plugin-data", "qoder-usage");
}
