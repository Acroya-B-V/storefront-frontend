import type { MerchantTheme } from '@/types/merchant';

export function themeToCSS(theme: Partial<MerchantTheme>): string {
  return Object.entries(theme)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `--${cssKey}: ${value};`;
    })
    .join('\n  ');
}
