export function formatEngagementCount(n: number): string {
  if (n < 0) return "0";
  if (n < 1_000) return String(n);
  if (n < 10_000)
    return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.floor(n / 1_000) + "k";
  if (n < 1_000_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "b";
}
