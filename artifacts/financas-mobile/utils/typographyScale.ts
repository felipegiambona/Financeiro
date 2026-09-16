import { StyleSheet } from 'react-native';

// Keep the experiment reversible: changing this factor adjusts every
// StyleSheet typography size without changing individual screen contracts.
const FONT_SCALE = 1.08;
const PATCH_MARKER = '__financasTypographyScaleApplied';

type StyleValue = Record<string, unknown>;
type StyleSheetWithMarker = typeof StyleSheet & {
  [PATCH_MARKER]?: boolean;
};

function scale(value: number): number {
  return Math.round(value * FONT_SCALE * 100) / 100;
}

function scaleStyleValue(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const style = { ...(value as StyleValue) };
  if (typeof style.fontSize === 'number') {
    style.fontSize = scale(style.fontSize);
    if (typeof style.lineHeight === 'number') {
      style.lineHeight = scale(style.lineHeight);
    }
  }
  return style;
}

function scaleStyles(styles: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(styles).map(([key, value]) => [key, scaleStyleValue(value)]),
  );
}

const styleSheet = StyleSheet as StyleSheetWithMarker;
if (!styleSheet[PATCH_MARKER]) {
  const originalCreate = StyleSheet.create.bind(StyleSheet);
  styleSheet.create = ((styles: Record<string, unknown>) => (
    originalCreate(scaleStyles(styles) as never)
  )) as typeof StyleSheet.create;
  styleSheet[PATCH_MARKER] = true;
}