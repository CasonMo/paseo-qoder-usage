# Qoder Usage

View Qoder and Qoder CN account credits inside Paseo.

The plugin detects logins under `~/.qoder` and `~/.qoder-cn` and aggregates every logged-in site on one quota screen: Qoder CN when available, Qoder international when available, and both when both exist. Each site is a separate card with its own refresh button, so refreshing one site does not block the other. The sidebar row shows each site's combined credits (Plan + Add-on + Org resource package, for example `CN 0/3000 · Qoder 0/6000`). Each card shows plan type and expiry, Plan Credits, Add-on Credits, and the Org resource package, with progress bars changing color at 80% and 95%, plus a quota-exceeded notice and manual refresh.

## How it works

Quota is read through the official Qoder SDKs: `@qoder-ai/qoder-agent-sdk` with qodercli for the international site, and `@qodercn-ai/qodercn-agent-sdk` with qoderclicn/qodercn for Qoder CN. The SDK reuses the local CLI login session and asks the Qoder service for the account quota. The plugin itself never reads, stores, or decrypts your credentials.

## Setup

- qodercli or qodercn must be installed and logged in on this machine; quota is account-level and shows the currently logged-in account.
- Before the first quota read, the UI prompts you to download the Qoder SDKs (international and China, about 30MB with locked dependencies, from the npm registry). Nothing downloads until you click "Download and install"; without installing, no SDK files are written and no quota request is made. The public version check may still run.
- Supports macOS and Linux; requires Paseo 0.11.2 or later.

## Auto refresh

Choose off / 5 min / 15 min / 30 min / 1 hour / 6 hours / 24 hours. When enabled, the plugin reads the quota once in the background at the chosen interval; with "off" only manual refresh runs. Settings are stored in the local plugin data directory.

## Data and permissions

- Reads: the local qodercli or qodercn login session (through the official SDK) and the quota data returned by the Qoder service.
- Writes: only the local plugin data directory, to cache the quota and save the auto refresh setting.
- Network: the SDK talks to the Qoder service when a quota read runs; without the SDK installed or a read triggered, no quota request is made. There is also an update check (at most once an hour, reading only the public registry record and the pinned package.json from raw.githubusercontent.com and api.github.com, sending no data).
- No prompts, code, or file contents are sent.
