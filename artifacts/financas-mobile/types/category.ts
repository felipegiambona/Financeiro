export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface NewCategoryInput {
  name: string;
  color?: string;
}

export const CATEGORY_COLORS = [
  '#72A17D',
  '#E58A61',
  '#6C8BD8',
  '#B17BC4',
  '#D7A84A',
  '#55A7A1',
  '#D86F8C',
  '#8C8C8C',
  '#3A6EA5',
  '#2E8B57',
  '#B35C44',
  '#7A5FA6',
  '#C28A2C',
  '#2F8F9D',
  '#B44C75',
  '#5E6873',
] as const;