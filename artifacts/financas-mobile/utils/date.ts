export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

export function getSaoPauloDateParts(date: Date): CalendarDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string, fallback: number) => Number(parts.find((part) => part.type === type)?.value ?? fallback);
  return {
    year: value('year', date.getFullYear()),
    month: value('month', date.getMonth() + 1),
    day: value('day', date.getDate()),
  };
}

export function getSaoPauloToday(now = new Date()): Date {
  const { year, month, day } = getSaoPauloDateParts(now);
  return new Date(year, month - 1, day, 12);
}

export function getSaoPauloHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: 'numeric',
    hour12: false,
  }).format(date);
  return Number(hour) % 24;
}

export function getDateKey(date: Date): string {
  const { year, month } = getSaoPauloDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getSaoPauloMonthKey(date = new Date()): string {
  const { year, month } = getSaoPauloDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getSaoPauloDateKey(date = new Date()): string {
  const { year, month, day } = getSaoPauloDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getDayKey(date: Date): string {
  return getSaoPauloDateKey(date);
}

export function parseStoredDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12);
  }
  return new Date(value);
}

export function getMonthStart(date: Date): Date {
  const { year, month } = getSaoPauloDateParts(date);
  return new Date(year, month - 1, 1, 12);
}

export function shiftMonth(date: Date, offset: number): Date {
  const { year, month } = getSaoPauloDateParts(date);
  return new Date(year, month - 1 + offset, 1, 12);
}

export function formatMonthLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatMonthYearLabel(date: Date): string {
  return formatMonthLabel(date).replace(' de ', ' ');
}

export function formatShortMonthLabel(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(date);
  return formatted.replace('.', '').slice(0, 3).toUpperCase();
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(parseStoredDate(dateString));
}

export function formatTransactionGroupLabel(dateString: string, now = new Date()): string {
  const date = parseStoredDate(dateString);
  const today = getSaoPauloToday(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (getDayKey(date) === getDayKey(today)) return 'Hoje';
  if (getDayKey(date) === getDayKey(yesterday)) return 'Ontem';

  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatTime(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(new Date(dateString));
}

export function formatDateInput(date: Date): string {
  const { year, month, day } = getSaoPauloDateParts(date);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function parseDateInput(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function createLocalIsoDate(date?: Date): string {
  const source = date ?? getSaoPauloToday();
  const { year, month, day } = getSaoPauloDateParts(source);
  return new Date(
    year,
    month - 1,
    day,
    12,
  ).toISOString();
}

export function isFutureDate(dateString: string, now = new Date()): boolean {
  const date = parseStoredDate(dateString);
  const today = getSaoPauloToday(now);
  today.setHours(23, 59, 59, 999);
  return date.getTime() > today.getTime();
}