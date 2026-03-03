import type { MerchantConfig } from '@/types/merchant';

// import.meta.glob is statically analyzable by Vite — every .json file in
// this directory is included in the build. Fully dynamic import(`${slug}.json`)
// would NOT be analyzable and could silently fail in production.
const configs = import.meta.glob<{ default: MerchantConfig }>('./*.json', {
  eager: true,
});

// Build slug → config map once at module load
const configMap = new Map<string, MerchantConfig>();
for (const [path, mod] of Object.entries(configs)) {
  const slug = path.replace(/^\.\//, '').replace(/\.json$/, '');
  configMap.set(slug, mod.default);
}

export function loadMerchantConfig(slug: string): MerchantConfig | null {
  return configMap.get(slug) ?? null;
}

export function getAllMerchantSlugs(): string[] {
  return [...configMap.keys()];
}
