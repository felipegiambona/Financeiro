import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useCategories } from '@/context/CategoryContext';
import { useColors } from '@/hooks/useColors';
import { CATEGORY_COLORS, Category } from '@/types/category';

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { categories, loading, error, refresh, createCategory, updateCategory, deleteCategory } = useCategories();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const openEditor = (category?: Category) => {
    setEditingCategory(category ?? null);
    setName(category?.name ?? '');
    setColor(category?.color ?? CATEGORY_COLORS[0]);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!saving) setEditorOpen(false);
  };

  const saveCategory = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Nome obrigatório', 'Informe um nome para a categoria.');
      return;
    }
    try {
      setSaving(true);
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name: trimmedName, color });
      } else {
        await createCategory({ name: trimmedName, color });
      }
      setEditorOpen(false);
    } catch {
      Alert.alert('Não foi possível salvar', 'Verifique se já existe uma categoria com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (category: Category) => {
    Alert.alert(
      `Excluir ${category.name}?`,
      'Os lançamentos associados continuarão salvos, mas ficarão sem categoria.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteCategory(category.id).catch(() => {
              Alert.alert('Não foi possível excluir', 'Tente novamente.');
            });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Organização"
          title="Categorias"
          showBack
          actionLabel="Nova"
          actionIcon="plus"
          onAction={() => openEditor()}
        />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Use categorias para entender onde seus gastos estão concentrados.
        </Text>
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : categories.length === 0 ? (
          <EmptyState message="Você ainda não criou nenhuma categoria." />
        ) : (
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {categories.map((category, index) => (
              <React.Fragment key={category.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                <View style={styles.categoryRow}>
                  <View style={[styles.colorDot, { backgroundColor: category.color }]} />
                  <Text numberOfLines={1} style={[styles.categoryName, { color: colors.foreground }]}>{category.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Editar categoria ${category.name}`}
                    testID={`edit-category-${category.id}`}
                    onPress={() => openEditor(category)}
                    style={({ pressed }) => [styles.rowAction, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                  >
                    <Feather name="edit-2" size={15} color={colors.foreground} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir categoria ${category.name}`}
                    testID={`delete-category-${category.id}`}
                    onPress={() => confirmDelete(category)}
                    style={({ pressed }) => [styles.rowAction, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                  >
                    <Feather name="trash-2" size={15} color={colors.expense} />
                  </Pressable>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal animationType="fade" transparent visible={editorOpen} onRequestClose={closeEditor}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: colors.mutedForeground }]}>Categoria</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {editingCategory ? 'Editar categoria' : 'Nova categoria'}
                </Text>
              </View>
              <Pressable accessibilityLabel="Fechar" onPress={closeEditor} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Nome</Text>
            <TextInput
              accessibilityLabel="Nome da categoria"
              testID="category-name-input"
              autoFocus
              placeholder="Ex.: Alimentação"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
            />
            <Text style={[styles.label, { color: colors.foreground }]}>Cor</Text>
            <View style={styles.colorOptions}>
              {CATEGORY_COLORS.map((option) => {
                const selected = color === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Selecionar cor ${option}`}
                    onPress={() => setColor(option)}
                    style={[styles.colorOption, { backgroundColor: option, borderColor: selected ? colors.foreground : 'transparent' }]}
                  >
                    {selected ? <Feather name="check" size={15} color="#FFFFFF" /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable disabled={saving} onPress={closeEditor} style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={() => void saveCategory()} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}>
                <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Salvando...' : 'Salvar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 22 },
  listCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  categoryRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorDot: { width: 13, height: 13, borderRadius: 7 },
  categoryName: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  rowAction: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', borderRadius: 12, borderWidth: 1, padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalEyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  colorOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 },
  colorOption: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveButton: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  saveText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});