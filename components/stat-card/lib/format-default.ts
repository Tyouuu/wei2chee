const enPercentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/** Default delta formatter — convention: value is a fraction (0.124 = 12.4%). */
export function defaultDeltaFormat(value: number): string {
  return enPercentFormatter.format(value);
}
