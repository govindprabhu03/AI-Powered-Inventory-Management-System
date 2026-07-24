/**
 * Demand forecasting — statistics first.
 *
 * Language models are unreliable at arithmetic extrapolation, so the numbers
 * here are computed the honest way: a moving average of actual outward demand
 * from the ledger, a short-vs-long window trend, days-of-cover, and a reorder
 * suggestion based on lead time and safety stock. The AI's only job (Phase 6
 * chatbot) is to explain these figures, never to invent them.
 *
 * Pure functions with no I/O, so they are trivially testable.
 */

export type ForecastInput = {
  /** Outward units per day over the trailing window, oldest first. */
  dailyDemand: number[];
  available: number;
  incoming: number;
  /** Days until a replenishment order would arrive. */
  leadTimeDays?: number;
};

export type Forecast = {
  avgDailyDemand: number;
  forecast30: number;
  daysOfCover: number | null; // null when there is no demand
  reorderPoint: number;
  suggestedReorderQty: number;
  trend: "up" | "down" | "flat";
};

const mean = (xs: number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

export function forecast({
  dailyDemand,
  available,
  incoming,
  leadTimeDays = 14,
}: ForecastInput): Forecast {
  const avg = mean(dailyDemand);

  // Trend: compare the most recent 7 days to the 7 before them.
  const recent = mean(dailyDemand.slice(-7));
  const prior = mean(dailyDemand.slice(-14, -7));
  let trend: Forecast["trend"] = "flat";
  if (prior > 0) {
    const change = (recent - prior) / prior;
    if (change > 0.15) trend = "up";
    else if (change < -0.15) trend = "down";
  } else if (recent > 0) {
    trend = "up";
  }

  // Safety stock ~ one week of average demand; reorder point covers the lead
  // time plus that buffer.
  const safetyStock = avg * 7;
  const reorderPoint = Math.ceil(avg * leadTimeDays + safetyStock);

  // If projected position (available + already incoming) is below the reorder
  // point, order enough to reach a target covering lead time + a review period.
  const position = available + incoming;
  const target = Math.ceil(avg * (leadTimeDays + 14) + safetyStock);
  const suggestedReorderQty =
    position < reorderPoint ? Math.max(0, target - position) : 0;

  return {
    avgDailyDemand: Number(avg.toFixed(2)),
    forecast30: Math.round(avg * 30),
    daysOfCover: avg > 0 ? Math.floor(available / avg) : null,
    reorderPoint,
    suggestedReorderQty,
    trend,
  };
}

/** Turn dated stock-out events into a dense per-day series over `windowDays`. */
export function toDailySeries(
  events: { date: string; qty: number }[],
  windowDays: number,
): number[] {
  const buckets = new Map<string, number>();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  for (const e of events) {
    const day = e.date.slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + e.qty);
  }
  return [...buckets.values()];
}
