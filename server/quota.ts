import { execCommand, spawnProcess, terminateProcess } from "@getpaseo/plugin/server";
import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { QuotaBucket, QuotaSite, QuotaSnapshot } from "../shared/quota";
import { SDK_RUNTIME_LOCK, SDK_RUNTIME_MANIFEST } from "./sdk-runtime.generated";

const SDK_VERSION = "qoder-agent-sdk@1.0.53 + qodercn-agent-sdk@1.0.58";
const SDK_DIR = "qoder-usage";

/**
 * Runs inside its own Node process. It reuses the local qodercli/qoderclicn
 * sign-in (`qodercliAuth`) and asks the official SDK for the account quota.
 */
export const QODER_USAGE_SCRIPT = `const site = process.env.AGENT_USAGE_QODER_SITE === "qoder-cn" ? "qoder-cn" : "qoder";
const sdk = await import(site === "qoder-cn" ? "@qodercn-ai/qodercn-agent-sdk" : "@qoder-ai/qoder-agent-sdk");
const { qodercliAuth, query } = sdk;

const cliPath = process.env.AGENT_USAGE_QODER_CLI_PATH || undefined;
let release;
async function* noPrompt() {
  await new Promise((resolve) => {
    release = resolve;
  });
}
const q = query({
  prompt: noPrompt(),
  options: {
    auth: qodercliAuth(),
    cwd: process.cwd(),
    persistSession: false,
    ...(cliPath ? { pathToQoderCLIExecutable: cliPath } : {}),
  },
});
try {
  await q.initializationResult();
  const usage = await q.getUsageInfo();
  process.stdout.write(JSON.stringify({ ok: true, usage: usage ?? null }) + "\\n");
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }) + "\\n");
} finally {
  try {
    release?.();
  } catch {}
  setTimeout(() => process.exit(0), 3000).unref();
}
`;

export function emptySnapshot(error: string | null): QuotaSnapshot {
  return {
    ok: false,
    error,
    fetchedAt: null,
    site: null,
    userType: null,
    expiresAt: null,
    totalUsagePercentage: null,
    isQuotaExceeded: null,
    upgradeUrl: null,
    userQuota: null,
    addOnQuota: null,
    orgResourcePackage: null,
  };
}

function usageDir(pluginDataDir: string): string {
  return join(pluginDataDir, SDK_DIR);
}

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

async function which(name: string): Promise<string | null> {
  try {
    const { stdout } = await execCommand("/bin/sh", ["-c", `command -v ${name} 2>/dev/null`]);
    const value = stdout.trim();
    return value || null;
  } catch {
    return null;
  }
}

async function nvmBinaryCandidates(name: string): Promise<string[]> {
  try {
    const root = join(homedir(), ".nvm", "versions", "node");
    const versions = await readdir(root);
    versions.sort((a, b) => {
      const pa = a.replace(/^v/, "").split(".").map(Number);
      const pb = b.replace(/^v/, "").split(".").map(Number);
      for (let index = 0; index < 3; index += 1) {
        const diff = (pb[index] ?? 0) - (pa[index] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    return versions.map((version) => join(root, version, "bin", name));
  } catch {
    return [];
  }
}

async function firstExisting(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const expanded = expandHome(candidate);
    if (existsSync(expanded)) return expanded;
  }
  return null;
}

async function resolveNode(): Promise<{ command: string; env: Record<string, string> }> {
  const pathNode = await which("node");
  if (pathNode) return { command: pathNode, env: {} };
  const found = await firstExisting(["/opt/homebrew/bin/node", "/usr/local/bin/node", ...(await nvmBinaryCandidates("node"))]);
  if (found) return { command: found, env: {} };
  return { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: "1" } };
}

async function resolveNpm(): Promise<string | null> {
  const pathNpm = await which("npm");
  if (pathNpm) return pathNpm;
  return await firstExisting(["/opt/homebrew/bin/npm", "/usr/local/bin/npm", ...(await nvmBinaryCandidates("npm"))]);
}

async function versionedBinaries(dir: string, prefix: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.startsWith(`${prefix}-`))
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
      .map((entry) => join(dir, entry));
  } catch {
    return [];
  }
}

export function detectAvailableSites(env: NodeJS.ProcessEnv = process.env): QuotaSite[] {
  const globalDir = expandHome(env.QODER_CONFIG_DIR?.trim() || join(homedir(), ".qoder"));
  const cnDir = expandHome(env.QODERCN_CONFIG_DIR?.trim() || join(homedir(), ".qoder-cn"));
  const sites: QuotaSite[] = [];
  if (existsSync(join(cnDir, ".auth", "user"))) sites.push("qoder-cn");
  if (existsSync(join(globalDir, ".auth", "user"))) sites.push("qoder");
  return sites;
}

async function resolveQoderCli(site: QuotaSite): Promise<string | null> {
  if (site === "qoder-cn") {
    const pathCli = (await which("qoderclicn")) ?? (await which("qodercn"));
    if (pathCli) return pathCli;
    const cnDir = expandHome(process.env.QODERCN_CONFIG_DIR?.trim() || join(homedir(), ".qoder-cn"));
    return await firstExisting([
      ...(await versionedBinaries(join(cnDir, "bin", "qoderclicn"), "qoderclicn")),
      join(cnDir, "entry", "qodercn"),
      join(homedir(), ".local", "bin", "qoderclicn"),
    ]);
  }
  const pathCli = await which("qodercli");
  if (pathCli) return pathCli;
  return await firstExisting([join(homedir(), ".local", "bin", "qodercli"), join(homedir(), ".qoder", "entry", "qoder")]);
}

function augmentedPath(...dirs: Array<string | null | undefined>): string {
  const parts = dirs.filter((value): value is string => Boolean(value));
  return [...new Set([...parts, join(homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH ?? ""])]
    .filter(Boolean)
    .join(":");
}

interface RunResult {
  ok: boolean;
  error: string | null;
  stdout: string;
  stderr: string;
}

function runProcess(command: string, args: string[], options: { env: NodeJS.ProcessEnv; cwd: string; timeoutMs: number; maxBytes: number }): Promise<RunResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnProcess(command, args, { stdio: "pipe", env: options.env, cwd: options.cwd });
    } catch (error) {
      resolve({ ok: false, error: `无法启动进程：${error instanceof Error ? error.message : String(error)}`, stdout: "", stderr: "" });
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      void terminateProcess(child).catch(() => {});
      finish({ ok: false, error: `获取超时（${Math.round(options.timeoutMs / 1000)}s）`, stdout: "", stderr: stderr.slice(-300) });
    }, options.timeoutMs);
    timer.unref?.();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > options.maxBytes) {
        void terminateProcess(child).catch(() => {});
        finish({ ok: false, error: "输出超过大小上限", stdout: "", stderr: stderr.slice(-300) });
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 16 * 1024) stderr = stderr.slice(-16 * 1024);
    });
    child.on("error", (error) => finish({ ok: false, error: `进程错误：${error.message}`, stdout: "", stderr: "" }));
    child.on("close", (code) => finish({ ok: code === 0, error: code === 0 ? null : `退出码 ${code}`, stdout, stderr }));
    child.stdin.end();
  });
}

function redact(text: string): string {
  return text
    .replace(/\b(?:pt|jt|jrt|rt|dt)-[A-Za-z0-9._-]{6,}/g, "***")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{6,}/gi, "Bearer ***")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "***");
}

export interface SdkReady {
  ok: boolean;
  error: string | null;
  /** True when the SDK is not installed and the user has not confirmed the download yet. */
  needsInstall?: boolean;
}

export const SDK_INSTALL_MESSAGE =
  "读取额度需要下载 Qoder Agent SDK（国际版 + 国内版，来自 npm registry，含锁定依赖约 30MB）。点击「下载并安装」后才会下载。";

/**
 * Prepares the SDK runtime. With `install: false` the download never happens;
 * the caller gets `needsInstall` instead, so a decline leaves nothing installed.
 * The runtime tree is installed from the shipped lockfile via `npm ci`.
 */
export async function ensureSdk(pluginDataDir: string, options: { install: boolean }): Promise<SdkReady> {
  const dir = usageDir(pluginDataDir);
  try {
    const globalManifest = join(dir, "node_modules", "@qoder-ai", "qoder-agent-sdk", "package.json");
    const cnManifest = join(dir, "node_modules", "@qodercn-ai", "qodercn-agent-sdk", "package.json");
    if (existsSync(globalManifest) && existsSync(cnManifest)) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(join(dir, "usage.mjs"), QODER_USAGE_SCRIPT, { mode: 0o600 });
      return { ok: true, error: null };
    }
    if (!options.install) return { ok: false, error: SDK_INSTALL_MESSAGE, needsInstall: true };
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(join(dir, "package.json"), SDK_RUNTIME_MANIFEST, { mode: 0o600 });
    await writeFile(join(dir, "package-lock.json"), SDK_RUNTIME_LOCK, { mode: 0o600 });
    await writeFile(join(dir, "usage.mjs"), QODER_USAGE_SCRIPT, { mode: 0o600 });
    const npm = await resolveNpm();
    if (!npm) return { ok: false, error: "未找到 npm，无法安装 Qoder SDK" };
    const node = await resolveNode();
    console.log(`[qoder-usage] installing locked SDK runtime (${SDK_VERSION}) into ${dir}`);
    await execCommand(npm, ["ci", "--prefix", dir, "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
      timeout: 300000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PATH: augmentedPath(dirname(node.command)) },
    });
    if (!existsSync(globalManifest) || !existsSync(cnManifest)) return { ok: false, error: "Qoder SDK 安装后未找到，请重试" };
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: `准备 Qoder SDK 失败：${error instanceof Error ? error.message : String(error)}` };
  }
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function bucket(value: unknown): QuotaBucket | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    used: numOrNull(record.used),
    remaining: numOrNull(record.remaining),
    total: numOrNull(record.total ?? record.cap),
    percentage: numOrNull(record.percentage),
    unit: strOrNull(record.unit),
  };
}

export async function fetchQuota(
  pluginDataDir: string,
  options: { install: boolean; site: QuotaSite },
): Promise<{ ok: true; snapshot: QuotaSnapshot } | { ok: false; error: string; needsInstall?: boolean }> {
  const ready = await ensureSdk(pluginDataDir, options);
  if (!ready.ok) return { ok: false, error: ready.error ?? "Qoder SDK 未就绪", needsInstall: ready.needsInstall === true };
  const dir = usageDir(pluginDataDir);
  const node = await resolveNode();
  const cli = await resolveQoderCli(options.site);
  if (!cli) {
    return {
      ok: false,
      error: options.site === "qoder-cn" ? "未找到 qodercn，请先安装并登录 Qoder CN CLI" : "未找到 qodercli，请先安装并登录 Qoder CLI",
    };
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...node.env,
    PATH: augmentedPath(dirname(node.command), dirname(cli)),
    AGENT_USAGE_QODER_SITE: options.site,
    AGENT_USAGE_QODER_CLI_PATH: cli,
  };
  const result = await runProcess(node.command, [join(dir, "usage.mjs")], { env, cwd: dir, timeoutMs: 90000, maxBytes: 1024 * 1024 });
  if (!result.ok) {
    const detail = redact(result.stderr.trim().split("\n").map((line) => line.trim()).filter(Boolean).slice(-2).join(" | "));
    return { ok: false, error: result.error ? `${result.error}${detail ? `：${detail.slice(0, 300)}` : ""}` : "获取失败" };
  }
  const line = result.stdout.trim().split("\n").filter(Boolean).pop();
  if (!line) return { ok: false, error: "SDK 没有输出结果" };
  let parsed: { ok?: unknown; error?: unknown; usage?: unknown };
  try {
    parsed = JSON.parse(line) as { ok?: unknown; error?: unknown; usage?: unknown };
  } catch {
    return { ok: false, error: `无法解析 SDK 输出：${line.slice(0, 200)}` };
  }
  if (parsed.ok !== true) {
    return { ok: false, error: typeof parsed.error === "string" && parsed.error ? redact(parsed.error) : "获取失败" };
  }
  const usage = parsed.usage;
  if (!usage || typeof usage !== "object") {
    return {
      ok: false,
      error: options.site === "qoder-cn" ? "额度不可用（请确认本机 qodercn 已登录）" : "额度不可用（请确认本机 qodercli 已登录）",
    };
  }
  const record = usage as Record<string, unknown>;
  return {
    ok: true,
    snapshot: {
      ok: true,
      error: null,
      fetchedAt: Date.now(),
      site: options.site,
      userType: strOrNull(record.userType),
      expiresAt: numOrNull(record.expiresAt),
      totalUsagePercentage: numOrNull(record.totalUsagePercentage),
      isQuotaExceeded: boolOrNull(record.isQuotaExceeded),
      upgradeUrl: strOrNull(record.upgradeUrl),
      userQuota: bucket(record.userQuota),
      addOnQuota: bucket(record.addOnQuota),
      orgResourcePackage: bucket(record.orgResourcePackage),
    },
  };
}
