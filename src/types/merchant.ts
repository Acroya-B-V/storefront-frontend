export interface MerchantTheme {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  cardImage: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
  fontHeading: string;
  fontBody: string;
}

export interface MerchantHours {
  days: string;
  open: string;
  close: string;
}

export interface MerchantConfig {
  slug: string;
  merchantId: string;
  name: string;
  description: string;
  logo: string;
  heroImage: string;
  favicon: string;
  languages: string[];
  defaultLanguage: string;
  currency: string;
  theme: MerchantTheme;
  layout: 'grid' | 'list';
  contact: {
    phone: string;
    email: string;
    address: string;
  };
  hours: MerchantHours[];
  social: Record<string, string>;
  website?: string;
  features?: {
    upsells?: boolean;
  };
  seo: {
    titleTemplate: string;
    defaultDescription: string;
  };
}
