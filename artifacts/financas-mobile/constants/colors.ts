/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#122033',
    tint: '#122033',
    background: '#F5F7F4',
    foreground: '#122033',
    card: '#FFFFFF',
    cardForeground: '#122033',
    primary: '#122033',
    primaryForeground: '#FFFFFF',
    secondary: '#E9F0E7',
    secondaryForeground: '#36523A',
    muted: '#E9EEE9',
    mutedForeground: '#6D7B74',
    accent: '#B8EF91',
    accentForeground: '#122033',
    destructive: '#C85151',
    destructiveForeground: '#FFFFFF',
    border: '#DDE5DE',
    input: '#D5DED7',
    income: '#2F8053',
    incomeSoft: '#E4F4E9',
    expense: '#B94B50',
    expenseSoft: '#FCE8E8',
    navySoft: '#243B53',
  },
  radius: 18,
};

export default colors;
