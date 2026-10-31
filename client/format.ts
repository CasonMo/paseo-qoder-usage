export function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/** Qoder returns a 0..1 share; older snapshots may already be 0..100. */
export function percentageOf(value: number | null): number | null {
  if (value === null) return null;
  return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
}

export function formatDate(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTime(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
