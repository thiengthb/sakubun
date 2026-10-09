import { useColorScheme } from 'react-native';

const light = {
  bg: '#ffffff',
  card: '#f5f5f5',
  text: '#171717',
  muted: '#6b7280',
  border: '#e5e7eb',
  accent: '#2563eb',
  danger: '#dc2626',
  onAccent: '#ffffff',
};

const dark: typeof light = {
  bg: '#0a0a0a',
  card: '#171717',
  text: '#fafafa',
  muted: '#9ca3af',
  border: '#262626',
  accent: '#60a5fa',
  danger: '#f87171',
  onAccent: '#0a0a0a',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
