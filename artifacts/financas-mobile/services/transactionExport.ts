import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { formatCurrency } from '@/utils/currency';
import { formatDate, parseStoredDate } from '@/utils/date';

export type TransactionExportFormat = 'csv' | 'pdf';

export interface TransactionExportItem {
  date: string;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  category: string;
  wallet: string;
  destinationWallet: string;
  status: 'paid' | 'unpaid';
  amount: number;
  recurrence: string;
}

const TYPE_LABELS: Record<TransactionExportItem['type'], string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
};

const STATUS_LABELS: Record<TransactionExportItem['status'], string> = {
  paid: 'Pago',
  unpaid: 'Não pago',
};

function recurrenceLabel(item: TransactionExportItem): string {
  return item.recurrence === 'none' ? 'Não recorrente' : item.recurrence;
}

function escapeCsvCell(value: string | number): string {
  const normalized = String(value).replace(/\r?\n/g, ' ');
  const protectedValue = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function createCsv(items: TransactionExportItem[]): string {
  const headers = [
    'Data',
    'Tipo',
    'Descrição',
    'Categoria',
    'Carteira',
    'Carteira destino',
    'Status',
    'Valor',
    'Recorrência',
  ];
  const rows = items.map((item) => [
    formatDate(item.date),
    TYPE_LABELS[item.type],
    item.description,
    item.category,
    item.wallet,
    item.destinationWallet,
    STATUS_LABELS[item.status],
    formatCurrency(item.amount),
    recurrenceLabel(item),
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(';'))
    .join('\r\n')}`;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createPdfHtml(items: TransactionExportItem[], periodLabel: string): string {
  const rows = items.map((item) => {
    const typeLabel = TYPE_LABELS[item.type];
    const typeClass = item.type === 'income' ? 'income' : item.type === 'expense' ? 'expense' : 'transfer';
    return `
      <tr>
        <td>${escapeHtml(formatDate(item.date))}</td>
        <td><span class="type ${typeClass}">${escapeHtml(typeLabel)}</span></td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.wallet)}${item.destinationWallet ? `<small>→ ${escapeHtml(item.destinationWallet)}</small>` : ''}</td>
        <td>${escapeHtml(STATUS_LABELS[item.status])}</td>
        <td class="amount ${typeClass}">${escapeHtml(formatCurrency(item.amount))}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Extrato de lançamentos</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          * { box-sizing: border-box; }
          body { color: #1f2933; font-family: Arial, sans-serif; margin: 0; }
          header { border-bottom: 2px solid #1f2933; margin-bottom: 18px; padding-bottom: 10px; }
          h1 { font-size: 22px; margin: 0 0 5px; }
          p { color: #52606d; font-size: 12px; margin: 0; }
          table { border-collapse: collapse; font-size: 10px; width: 100%; }
          th { background: #f0f2f2; color: #52606d; font-size: 9px; text-align: left; text-transform: uppercase; }
          th, td { border-bottom: 1px solid #d9e2ec; padding: 7px 6px; vertical-align: top; }
          td small { color: #7b8794; display: block; font-size: 9px; margin-top: 3px; }
          .type { border-radius: 4px; display: inline-block; font-size: 9px; padding: 3px 5px; }
          .income { color: #287d45; }
          .expense { color: #b33a3a; }
          .transfer { color: #536171; }
          .type.income { background: #e4f4e9; }
          .type.expense { background: #fce8e8; }
          .type.transfer { background: #eef0f1; }
          .amount { font-weight: bold; text-align: right; white-space: nowrap; }
          footer { color: #7b8794; font-size: 9px; margin-top: 14px; }
        </style>
      </head>
      <body>
        <header>
          <h1>Extrato de lançamentos</h1>
          <p>${escapeHtml(periodLabel)} · ${items.length} ${items.length === 1 ? 'lançamento' : 'lançamentos'}</p>
        </header>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Carteira</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <footer>Arquivo gerado pelo Finanças Mobile.</footer>
      </body>
    </html>`;
}

function createFileName(format: TransactionExportFormat): string {
  const stamp = new Intl.DateTimeFormat('en-CA').format(new Date()).replace(/-/g, '');
  return `extrato-lancamentos-${stamp}.${format}`;
}

function downloadOnWeb(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function printOnWeb(html: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Não foi possível abrir a janela de impressão.');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function shareNativeFile(uri: string, format: TransactionExportFormat): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
  }
  // Android does not allow another app to read the private file:// URI directly.
  // Expo FileSystem exposes a temporary content:// URI with the required grant.
  const shareUri = Platform.OS === 'android' ? new File(uri).contentUri : uri;
  await Sharing.shareAsync(shareUri, {
    dialogTitle: `Salvar ou compartilhar ${format.toUpperCase()}`,
    mimeType: format === 'csv' ? 'text/csv' : 'application/pdf',
    UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'com.adobe.pdf',
  });
}

export async function exportTransactions(
  items: TransactionExportItem[],
  periodLabel: string,
  format: TransactionExportFormat,
): Promise<void> {
  if (items.length === 0) throw new Error('Não há lançamentos para exportar.');

  if (format === 'csv') {
    const csv = createCsv(items);
    if (Platform.OS === 'web') {
      downloadOnWeb(csv, createFileName('csv'), 'text/csv;charset=utf-8');
      return;
    }
    if (!FileSystem.cacheDirectory) throw new Error('O armazenamento temporário não está disponível.');
    const uri = `${FileSystem.cacheDirectory}${createFileName('csv')}`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await shareNativeFile(uri, 'csv');
    return;
  }

  const html = createPdfHtml(items, periodLabel);
  if (Platform.OS === 'web') {
    printOnWeb(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await shareNativeFile(uri, 'pdf');
}

export function getExportPeriodLabel(
  selectedMonth: Date,
  dateRangeStart: Date | null,
  dateRangeEnd: Date | null,
): string {
  if (dateRangeStart || dateRangeEnd) {
    const start = dateRangeStart ? formatDate(dateRangeStart.toISOString()) : 'Início';
    const end = dateRangeEnd ? formatDate(dateRangeEnd.toISOString()) : 'Fim';
    return `${start} até ${end}`;
  }
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(parseStoredDate(selectedMonth.toISOString()));
}