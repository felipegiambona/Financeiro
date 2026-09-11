import {
  createCategory as createCategoryRequest,
  deleteCategory as deleteCategoryRequest,
  listCategories,
  updateCategory as updateCategoryRequest,
} from '@workspace/api-client-react';
import type { Category, NewCategoryInput } from '@/types/category';

export async function getCategories(): Promise<Category[]> {
  return listCategories() as Promise<Category[]>;
}

export async function createCategory(input: NewCategoryInput): Promise<Category> {
  return createCategoryRequest({
    name: input.name.trim(),
    ...(input.color ? { color: input.color } : {}),
  }) as Promise<Category>;
}

export async function updateCategory(
  id: string,
  updates: Partial<Omit<Category, 'id' | 'createdAt'>>,
): Promise<Category> {
  return updateCategoryRequest(id, updates) as Promise<Category>;
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteCategoryRequest(id);
}