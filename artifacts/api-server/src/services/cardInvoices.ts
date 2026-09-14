export type CardInvoiceStatus = "open" | "closed" | "paid" | "overdue";

export interface CardInvoiceSummary {
  invoiceMonth: string;
  amount: number;
  status: CardInvoiceStatus;
  dueDate: string;
  closingDate: string;
}

type InvoiceRow = {
  date: string | Date;
  amount: string | number;
  cardEntryType: string;
  cardInvoiceMonth?: string | null;
};

function localDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  return Array.from(months)
    .sort()
    .map((invoiceMonth) => {
      const amount = Math.round((amounts.get(invoiceMonth) ?? 0) * 100) / 100;
      const paidAmount = payments.get(invoiceMonth) ?? 0;
      const isPaid = amount > 0 && paidAmount >= amount;
      const isCurrent = invoiceMonth === currentMonth;
      const isPast = invoiceMonth < currentMonth;
      let status: CardInvoiceStatus = "open";

      if (isPaid) {
        status = "paid";
      } else if (isPast) {
        status = "overdue";
      } else if (isCurrent) {
        if (now.getDate() >= dueDay && now.getDate() >= closingDay) status = "overdue";
        else if (now.getDate() >= closingDay) status = "closed";
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