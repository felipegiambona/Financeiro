import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createCategory as persistCategory,
  deleteCategory as removeCategory,
  getCategories,
  updateCategory as updatePersistedCategory,
} from '@/services/categoryRepository';
import type { Category, NewCategoryInput } from '@/types/category';

interface CategoryContextValue {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCategory: (input: NewCategoryInput) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: React.PropsWithChildren) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setCategories(await getCategories());
    } catch {
      setError('Não foi possível carregar suas categorias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCategory = useCallback(async (input: NewCategoryInput): Promise<Category> => {
    try {
      setError(null);
      const category = await persistCategory(input);
      await refresh();
      return category;
    } catch {
      setError('Não foi possível salvar a categoria.');
      throw new Error('Não foi possível salvar a categoria.');
    }
  }, [refresh]);

  const updateCategory = useCallback(async (
    id: string,
    updates: Partial<Omit<Category, 'id' | 'createdAt'>>,
  ) => {
    try {
      setError(null);
      await updatePersistedCategory(id, updates);
      await refresh();
    } catch {
      setError('Não foi possível atualizar a categoria.');
      throw new Error('Não foi possível atualizar a categoria.');
    }
  }, [refresh]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      setError(null);
      await removeCategory(id);
      await refresh();
    } catch {
      setError('Não foi possível excluir a categoria.');
      throw new Error('Não foi possível excluir a categoria.');
    }
  }, [refresh]);

  const value = useMemo(
    () => ({ categories, loading, error, refresh, createCategory, updateCategory, deleteCategory }),
    [categories, createCategory, deleteCategory, error, loading, refresh, updateCategory],
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategories(): CategoryContextValue {
  const context = useContext(CategoryContext);
  if (!context) throw new Error('useCategories deve ser usado dentro de CategoryProvider.');
  return context;
}