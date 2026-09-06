export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  const amount = Number(digits) / 100;
  return amount.toFixed(2).replace('.', ',');
}

export function parseAmountInput(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Number(normalized);
}