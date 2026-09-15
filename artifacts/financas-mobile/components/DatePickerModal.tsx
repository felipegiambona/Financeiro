import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { getDateKey, getSaoPauloDateParts, getSaoPauloToday, SAO_PAULO_TIME_ZONE } from '@/utils/date';

interface DatePickerModalProps {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  eyebrow?: string;
}

const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

function isSameDay(first: Date, second: Date): boolean {
  return getDateKey(first) === getDateKey(second)
    && getSaoPauloDateParts(first).day === getSaoPauloDateParts(second).day;
}

function toCalendarDate(date: Date): Date {
  const { year, month, day } = getSaoPauloDateParts(date);
  return new Date(year, month - 1, day, 12);
}

export function DatePickerModal({
  visible,
  value,
  onClose,
  onConfirm,
  eyebrow = 'VENCIMENTO',
}: DatePickerModalProps) {
  const colors = useColors();
  const valueTime = value.getTime();
  const initialDate = toCalendarDate(value);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12));

  useEffect(() => {
    if (!visible) return;
    const nextDate = toCalendarDate(new Date(valueTime));
    setSelectedDate(nextDate);
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1, 12));
  }, [valueTime, visible]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 12);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      index - mondayOffset + 1,
      12,
    ));
  }, [visibleMonth]);

  const monthLabel = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: SAO_PAULO_TIME_ZONE,
  }).format(visibleMonth);
  const today = getSaoPauloToday();

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Fechar calendário" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
              </Text>
            </View>
            <View style={styles.monthActions}>
              <Pressable
                accessibilityLabel="Mês anterior"
                onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}
                style={({ pressed }) => [styles.monthButton, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Feather name="chevron-left" size={17} color={colors.foreground} />
              </Pressable>
              <Pressable
                accessibilityLabel="Próximo mês"
                onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}
                style={({ pressed }) => [styles.monthButton, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Feather name="chevron-right" size={17} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
          <View style={styles.weekdays}>
            {WEEKDAYS.map((weekday) => (
              <Text key={weekday} style={[styles.weekday, { color: colors.mutedForeground }]}>{weekday}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {calendarDays.map((date) => {
              const inMonth = date.getMonth() === visibleMonth.getMonth();
              const selected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              return (
                <Pressable
                  key={`${getDateKey(date)}-${date.getDate()}`}
                  accessibilityLabel={`${date.getDate()} de ${new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: SAO_PAULO_TIME_ZONE }).format(date)}`}
                  onPress={() => setSelectedDate(date)}
                  style={({ pressed }) => [
                    styles.day,
                    selected && { backgroundColor: colors.accent },
                    isToday && !selected && { borderColor: colors.primary, borderWidth: 1 },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[
                    styles.dayText,
                    { color: inMonth ? colors.foreground : colors.mutedForeground },
                    !inMonth && styles.outsideDay,
                    selected && { color: colors.accentForeground },
                  ]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(selectedDate)} style={({ pressed }) => [styles.confirmButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
              <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.76)', justifyContent: 'center', paddingHorizontal: 18 },
  card: { width: '100%', maxWidth: 370, alignSelf: 'center', borderRadius: 12, borderWidth: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.4, marginBottom: 5 },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  monthActions: { flexDirection: 'row', gap: 6 },
  monthButton: { width: 31, height: 31, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  weekdays: { flexDirection: 'row', marginBottom: 5 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: '14.2857%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayText: { includeFontPadding: false, lineHeight: 18, textAlign: 'center', textAlignVertical: 'center', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  outsideDay: { opacity: 0.35 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, marginTop: 14, paddingTop: 13 },
  footerButton: { minHeight: 38, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  confirmButton: { minHeight: 38, borderRadius: 7, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});