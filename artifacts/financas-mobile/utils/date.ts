export function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseStoredDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12);
  }
  return new Date(value);
}

export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function shiftMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1, 12);
}

export function formatMonthLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortMonthLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
  }).format(date);
  return formatted.replace('.', '').slice(0, 3).toUpperCase();
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(parseStoredDate(dateString));
}

export function createLocalIsoDate(date = new Date()): string {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
  ).toISOString();
}

export function isFutureDate(dateString: string, now = new Date()): boolean {
  const date = parseStoredDate(dateString);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return date.getTime() > today.getTime();
}