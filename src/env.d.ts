// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    merchant: import('./types/merchant').MerchantConfig;
    lang: string;
    sdk: import('./lib/sdk-stub').StorefrontClient;
  }
}

interface ImportMetaEnv {
  readonly API_BASE_URL: string;
  readonly PUBLIC_API_BASE_URL: string;
  readonly DEFAULT_MERCHANT: string;
  readonly CUSTOM_DOMAINS: string;
  readonly PUBLIC_POSTHOG_KEY: string;
  readonly PUBLIC_POSTHOG_HOST: string;
  readonly AUTH_COOKIE_DOMAIN: string;
  readonly AUTH_COOKIE_SECURE: string;
  readonly PUBLIC_ENVIRONMENT: string;
}
