/**
 * Calculate Steadman apparent temperature (feels like) based on air temperature (°C),
 * relative humidity (%), and wind speed (m/s).
 */
export function calculateFeelsLike(
  temp: number | null | undefined,
  humidity: number | null | undefined,
  windSpeed: number | null | undefined
): number {
  if (temp == null) return 0;
  const rh = humidity ?? 50;
  const ws = windSpeed ?? 0;
  const e = (rh / 100) * 6.105 * Math.exp((17.27 * temp) / (237.7 + temp));
  const at = temp + 0.33 * e - 0.70 * ws - 4.0;
  return Math.round(at * 10) / 10;
}
