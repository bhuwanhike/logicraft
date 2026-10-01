import { useCallback, useEffect, useState } from 'react';
import type { Theme, UseThemeResult } from '../types';

const THEME_KEY = 'logicraft.theme';
const DARK_CLASS = 'dark-mode';

const readStoredTheme = (): Theme | null => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? (saved as Theme) : null;
  } catch {
    // Private-mode Safari and locked-down embeds throw on access rather than
    // returning null, so a failed read just means "no stored preference".
    return null;
  }
};

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const initialTheme = (): Theme => readStoredTheme() ?? systemTheme();

/**
 * Light/dark theme for the shell.
 *
 * styles.css already ships a `.dark-mode` palette keyed on a class, so this
 * only owns that class and the stored preference. Two details worth keeping:
 *
 * - The class goes on <html>, not <body>. The base palette sets page-level
 *   tokens (--bg) there, and `.dark-mode .app-shell` reads them, so putting it
 *   lower in the tree would leave the tokens undefined on :root.
 * - The first paint is corrected in index.html by a blocking snippet that
 *   reuses this key, so a dark-mode reload never flashes a white page. This
 *   effect is what keeps React in step afterwards.
 */
export function useTheme(): UseThemeResult {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const isDark = theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(DARK_CLASS, isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    // Keep the browser chrome (mobile address bar) in step with the page.
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      isDark ? '#162130' : '#f5f7fb'
    );
  }, [isDark]);

  // Follow the OS only while the user has not made an explicit choice.
  useEffect(() => {
    if (readStoredTheme()) return undefined;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setTheme(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Preference is not persistable here; the toggle still works for this
        // session, it just will not be remembered.
      }
      return next;
    });
  }, []);

  return { theme, isDark, toggleTheme };
}
