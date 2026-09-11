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
    radio: '#72A17D',
    destructive: '#C85151',
    destructiveForeground: '#FFFFFF',
    border: '#DDE5DE',
    input: '#D5DED7',
    income: '#2F8053',
    incomeSoft: '#E4F4E9',
    expense: '#B94B50',
    expenseSoft: '#FCE8E8',
    transfer: '#667085',
    transferSoft: '#EEF0F1',
    paid: '#2F8053',
    paidSoft: '#E4F4E9',
    pending: '#B87820',
    pendingSoft: '#FFF1D7',
    navySoft: '#243B53',
  },
  dark: {
    text: '#F5F5F5',
    tint: '#D4D4D4',
    background: '#090909',
    foreground: '#F5F5F5',
    card: '#151515',
    cardForeground: '#F5F5F5',
    primary: '#242424',
    primaryForeground: '#F5F5F5',
    secondary: '#1C1C1C',
    secondaryForeground: '#B5B5B5',
    muted: '#171717',
    mutedForeground: '#929292',
    accent: '#E5E5E5',
    accentForeground: '#101010',
    radio: '#B8EF91',
    destructive: '#D98989',
    destructiveForeground: '#160D0D',
    border: '#292929',
    input: '#343434',
    income: '#B5D2BC',
    incomeSoft: '#202A23',
    expense: '#D7A5A5',
    expenseSoft: '#2B2020',
    transfer: '#B5B5B5',
    transferSoft: '#2A2A2A',
    paid: '#B5D2BC',
    paidSoft: '#202A23',
    pending: '#C8B07B',
    pendingSoft: '#2B271D',
    navySoft: '#252525',
  },
  radius: 8,
};

export default colors;
