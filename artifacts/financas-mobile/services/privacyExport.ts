import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

function fileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `financas-mobile-dados-${date}.json`;
}

function downloadOnWeb(content: string, name: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function sharePrivacyExport(data: unknown): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  const name = fileName();

  if (Platform.OS === 'web') {
    downloadOnWeb(content, name);
    return;
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('O armazenamento local não está disponível.');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
  }

  const uri = `${FileSystem.documentDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, {
    dialogTitle: 'Salvar ou compartilhar meus dados',
    mimeType: 'application/json',
    UTI: 'public.json',
  });
}