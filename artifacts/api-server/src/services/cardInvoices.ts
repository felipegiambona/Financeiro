export type CardInvoiceStatus = "open" | "closed" | "paid" | "overdue";
const CARD_TIME_ZONE = "America/Sao_Paulo";

export interface CardInvoiceSummary {
  invoiceMonth: string;
  amount: number;
  status: CardInvoiceStatus;
  dueDate: string;
  closingDate: string;
}

export function calculateAvailableLimit(
  availableLimit: string | number | null | undefined,
  invoices: CardInvoiceSummary[],
): number | null {
  if (availableLimit == null) return null;
  const outstanding = invoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((total, invoice) => total + invoice.amount, 0);
  return Math.max(0, Number(availableLimit) - outstanding);
}

type InvoiceRow = {
  date: string | Date;
  amount: string | number;
  cardEntryType: string;
  cardInvoiceMonth?: string | null;
};

function localDate(value: string | Date): Date {
  if (value instanceof Date) {
    const { year, month, day } = calendarDateParts(value);
    return new Date(year, month - 1, day, 12);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  return localDate(new Date(value));
}

function calendarDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function monthKey(date: Date): string {
  const { year, month } = calendarDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthDate(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
}

export function dayDate(month: string, day: number): string {
  const date = monthDate(month);
  const safeDay = Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

export function dateKey(value: Date | string): string {
  const date = typeof value === "string" ? localDate(value) : value;
  const { year, month, day } = calendarDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function invoiceMonthForPurchase(date: string | Date, closingDay: number): string {
  const purchaseDate = localDate(date);
  return monthKey(purchaseDate.getDate() > closingDay ? addMonths(purchaseDate, 1) : purchaseDate);
}

export function invoiceMonthForPayment(row: InvoiceRow): string {
  return row.cardInvoiceMonth ?? monthKey(localDate(row.date));
}

export function getCardInvoiceSummaries(
  rows: InvoiceRow[],
  closingDay: number,
  dueDay: number,
  now = new Date(),
): CardInvoiceSummary[] {
  const amounts = new Map<string, number>();
  const payments = new Map<string, number>();
  const months = new Set<string>([monthKey(now)]);

  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (row.cardEntryType === "invoice_payment") {
      const invoiceMonth = invoiceMonthForPayment(row);
      payments.set(invoiceMonth, (payments.get(invoiceMonth) ?? 0) + amount);
      months.add(invoiceMonth);
      continue;
    }
    const invoiceMonth = row.cardInvoiceMonth ?? invoiceMonthForPurchase(row.date, closingDay);
    amounts.set(invoiceMonth, (amounts.get(invoiceMonth) ?? 0) + amount);
    months.add(invoiceMonth);
  }

  const currentMonth = monthKey(now);
  const currentDay = calendarDateParts(now).day;
  return Array.from(months)
    .sort()
    .map((invoiceMonth) => {
      const amount = Math.round((amounts.get(invoiceMonth) ?? 0) * 100) / 100;
      const paidAmount = payments.get(invoiceMonth) ?? 0;
      const isPaid = amount > 0 && paidAmount >= amount;
      const isCurrent = invoiceMonth === currentMonth;
      const isPast = invoiceMonth < currentMonth;
      let status: CardInvoiceStatus = "open";

       if (amount <= 0) {
         status = "open";
       } else if (isPaid) {
        status = "paid";
      } else if (isPast) {
        status = "overdue";
      } else if (isCurrent) {
        if (currentDay >= dueDay && currentDay >= closingDay) status = "overdue";
        else if (currentDay >= closingDay) status = "closed";
      }

      return {
        invoiceMonth,
        amount,
        status,
        dueDate: dayDate(invoiceMonth, dueDay),
        closingDate: dayDate(invoiceMonth, closingDay),
      };
    })
    .filter((invoice) => invoice.amount > 0 || invoice.invoiceMonth === currentMonth);
}