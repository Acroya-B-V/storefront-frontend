export function langToLocale(lang: string): string {
  if (lang === 'nl') return 'nl-NL';
  if (lang === 'de') return 'de-DE';
  return 'en-GB';
}

export function formatPrice(amount: string, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Number(amount));
}
