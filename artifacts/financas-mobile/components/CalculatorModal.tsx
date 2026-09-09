import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { evaluateExpression, formatCalculatorValue } from '@/utils/calculator';

type CalculatorKey = {
  label: string;
  value?: string;
  kind?: 'operator' | 'action' | 'equals';
};

const KEY_ROWS: CalculatorKey[][] = [
  [
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '÷', value: '÷', kind: 'operator' },
  ],
  [
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '×', value: '×', kind: 'operator' },
  ],
  [
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '−', value: '−', kind: 'operator' },
  ],
  [
    { label: '0', value: '0' },
    { label: ',', value: ',', kind: 'operator' },
    { label: '+', value: '+', kind: 'operator' },
    { label: '=', kind: 'equals' },
  ],
];

interface CalculatorModalProps {
  initialValue: string;
  onClose: () => void;
  onApply: (value: number) => void;
}

export function CalculatorModal({ initialValue, onClose, onApply }: CalculatorModalProps) {
  const colors = useColors();
  const [expression, setExpression] = useState(initialValue || '');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState('');

  const updateExpression = (nextExpression: string) => {
    setExpression(nextExpression);
    setResult(null);
    setError('');
  };

  const appendValue = (value: string) => {
    updateExpression(`${expression}${value}`);
  };

  const appendDecimal = () => {
    const currentNumber = expression.split(/[+−×÷]/).pop() ?? '';
    if (currentNumber.includes(',')) return;
    if (!expression || /[+−×÷]$/.test(expression)) {
      appendValue('0,');
      return;
    }
    appendValue(',');
  };

  const appendOperator = (operator: string) => {
    if (!expression) {
      if (operator === '−') appendValue(operator);
      return;
    }
    if (/[+−×÷]$/.test(expression)) {
      updateExpression(`${expression.slice(0, -1)}${operator}`);
      return;
    }
    appendValue(operator);
  };

  const calculate = () => {
    const nextResult = evaluateExpression(expression);
    if (nextResult === null) {
      setError('Confira a expressão e tente novamente.');
      setResult(null);
      return;
    }
    setResult(nextResult);
    setExpression(formatCalculatorValue(nextResult));
    setError('');
  };

  const handleKeyPress = (key: CalculatorKey) => {
    if (key.kind === 'equals') {
      calculate();
      return;
    }
    if (key.kind === 'operator' && key.value === ',') {
      appendDecimal();
      return;
    }
    if (key.kind === 'operator') {
      appendOperator(key.value ?? '');
      return;
    }
    appendValue(key.value ?? '');
  };

  const applyResult = () => {
    if (result === null) return;
    if (result <= 0) {
      setError('O valor do lançamento precisa ser maior que zero.');
      return;
    }
    onApply(result);
  };

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Fechar calculadora" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>Calculadora</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Calcule o valor do lançamento</Text>
            </View>
            <Pressable accessibilityLabel="Fechar calculadora" onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.secondary }]}>
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={[styles.display, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.expression, { color: colors.mutedForeground }]}>
              {expression || '0'}
            </Text>
            {result !== null ? (
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.result, { color: colors.foreground }]}>
                {formatCalculatorValue(result)}
              </Text>
            ) : null}
          </View>
          {error ? <Text style={[styles.error, { color: colors.expense }]}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar calculadora"
              onPress={() => updateExpression('')}
              style={({ pressed }) => [styles.actionKey, { backgroundColor: colors.expenseSoft }, pressed && styles.pressed]}
            >
              <Text style={[styles.actionKeyText, { color: colors.expense }]}>C</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apagar último caractere"
              onPress={() => updateExpression(expression.slice(0, -1))}
              style={({ pressed }) => [styles.actionKey, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
            >
              <Feather name="delete" size={18} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={styles.keypad}>
            {KEY_ROWS.flatMap((row, rowIndex) => row.map((key) => (
              <Pressable
                key={`${rowIndex}-${key.label}`}
                accessibilityRole="button"
                accessibilityLabel={key.label === '×' ? 'Multiplicar' : key.label === '÷' ? 'Dividir' : key.label}
                testID={`calculator-key-${key.label}`}
                onPress={() => handleKeyPress(key)}
                style={({ pressed }) => [
                  styles.key,
                  { backgroundColor: key.kind === 'equals' ? colors.accent : key.kind === 'operator' ? colors.secondary : colors.background },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.keyText, { color: key.kind === 'equals' ? colors.accentForeground : colors.foreground }]}>{key.label}</Text>
              </Pressable>
            )))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usar resultado da calculadora"
            disabled={result === null}
            onPress={applyResult}
            style={({ pressed }) => [
              styles.applyButton,
              { backgroundColor: colors.primary },
              result === null && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.applyButtonText}>Usar resultado no valor</Text>
            <Feather name="check" size={17} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.72)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  closeButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  display: { minHeight: 76, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'flex-end', justifyContent: 'center' },
  expression: { fontSize: 17, fontFamily: 'Inter_500Medium' },
  result: { fontSize: 27, fontFamily: 'Inter_700Bold', marginTop: 3 },
  error: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 7 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionKey: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionKeyText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  key: { width: '22.5%', minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  applyButton: { minHeight: 48, borderRadius: 8, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  applyButtonText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});