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
] as const;