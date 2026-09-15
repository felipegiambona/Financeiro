export const INVESTMENT_DIVIDEND_CALENDAR_SOURCE = "BRAPI" as const;

export type CalendarDividendType = "dividend" | "jcp";

export type DividendCalendarInvestment = {
  id: string;
  name: string;
  ticker: string | null;
  quantity: string | number;
};

export type CalendarDividendEvent = {
  sourceEventId: string;
  investmentId: string;
  investmentName: string;
  investmentTicker: string | null;
  type: CalendarDividendType;
  amount: number;
  paymentDate: string;
  source: typeof INVESTMENT_DIVIDEND_CALENDAR_SOURCE;
};

const TIME_ZONE = "America/Sao_Paulo";

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? null;
}

function typeFromLabel(value: unknown): CalendarDividendType | null {
  if (typeof value !== "string") return null;
  const label = value.toLocaleUpperCase("pt-BR");
  if (label.includes("JCP")) return "jcp";
  if (label.includes("DIVID")) return "dividend";
  return null;
}

export function parseBrapiDividendEvents(
  investment: DividendCalendarInvestment,
  payload: unknown,
  today = dateKey(new Date()),
): CalendarDividendEvent[] {
  const root = recordValue(payload);
  const results = root?.results;
  const result = Array.isArray(results) ? recordValue(results[0]) : null;
  const dividendsData = recordValue(result?.dividendsData);
  const cashDividends = dividendsData?.cashDividends;
  if (!Array.isArray(cashDividends)) return [];

  const quantity = Number(investment.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return [];

  const events: CalendarDividendEvent[] = [];
  for (const rawEvent of cashDividends) {
    const event = recordValue(rawEvent);
    const paymentDate = dateOnly(event?.paymentDate);
    const type = typeFromLabel(event?.label);
    const rate = typeof event?.rate === "number" ? event.rate : Number(event?.rate);
    if (!paymentDate || paymentDate < today || !type || !Number.isFinite(rate) || rate <= 0) continue;

    const amount = roundMoney(rate * quantity);
    if (amount <= 0) continue;
    const sourceEventId = [
      investment.ticker ?? investment.id,
      paymentDate,
      type,
      rate.toFixed(8),
    ].join(":");
    events.push({
      sourceEventId,
      investmentId: investment.id,
      investmentName: investment.name,
      investmentTicker: investment.ticker,
      type,
      amount,
      paymentDate,
      source: INVESTMENT_DIVIDEND_CALENDAR_SOURCE,
    });
  }

  return events.sort((left, right) => (
    left.paymentDate.localeCompare(right.paymentDate)
    || left.investmentName.localeCompare(right.investmentName)
    || left.type.localeCompare(right.type)
  ));
}

export async function fetchBrapiDividendEvents(
  investment: DividendCalendarInvestment,
  today = dateKey(new Date()),
): Promise<CalendarDividendEvent[]> {
  if (!investment.ticker) throw new Error("Investment has no B3 ticker");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      `https://brapi.dev/api/quote/${encodeURIComponent(investment.ticker)}?dividends=true`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) throw new Error(`BRAPI returned ${response.status}`);
    const payload = await response.json();
    return parseBrapiDividendEvents(investment, payload, today);
  } finally {
    clearTimeout(timeout);
  }
}