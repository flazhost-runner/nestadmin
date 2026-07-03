export interface ThemePalette {
  name: string;
  primary: string;
  secondary: string;
  light: string;
  dark: string;
}

export const THEMES: ThemePalette[] = [
  {
    name: 'Blue',
    primary: '#3B82F6',
    secondary: '#60A5FA',
    light: '#EFF6FF',
    dark: '#1E40AF',
  },
  {
    name: 'Purple',
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    light: '#F5F3FF',
    dark: '#5B21B6',
  },
  {
    name: 'Green',
    primary: '#10B981',
    secondary: '#34D399',
    light: '#ECFDF5',
    dark: '#065F46',
  },
  {
    name: 'Orange',
    primary: '#F59E0B',
    secondary: '#FCD34D',
    light: '#FFFBEB',
    dark: '#92400E',
  },
  {
    name: 'Red',
    primary: '#EF4444',
    secondary: '#F87171',
    light: '#FEF2F2',
    dark: '#991B1B',
  },
];

export function getTheme(name: string): ThemePalette {
  return THEMES.find((t) => t.name === name) || THEMES[0];
}
