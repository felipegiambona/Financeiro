export function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getSaoPauloDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
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

export function getSaoPauloMonthKey(date = new Date()): string {
  const { year, month } = getSaoPauloDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

export function formatMonthYearLabel(date: Date): string {
  return formatMonthLabel(date).replace(' de ', ' ');
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

export function formatTransactionGroupLabel(dateString: string, now = new Date()): string {
  const date = parseStoredDate(dateString);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (getDayKey(date) === getDayKey(today)) return 'Hoje';
  if (getDayKey(date) === getDayKey(yesterday)) return 'Ontem';

  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatTime(dateString: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

export function createLocalIsoDate(date?: Date): string {
  const source = date ?? new Date();
  const calendarDate = date
    ? source
    : (() => {
      const { year, month, day } = getSaoPauloDateParts(source);
      return new Date(year, month - 1, day, 12);
    })();
  return new Date(
    calendarDate.getFullYear(),
    calendarDate.getMonth(),
    calendarDate.getDate(),
    12,
  ).toISOString();
}

export function isFutureDate(dateString: string, now = new Date()): boolean {
  const date = parseStoredDate(dateString);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return date.getTime() > today.getTime();
}