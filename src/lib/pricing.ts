import { formatPrice } from './currency';

export interface Discount {
  type: 'percentage' | 'fixed' | 'bogo' | 'tiered';
  value?: number;
  buyQuantity?: number;
  getQuantity?: number;
  quantity?: number;
  price?: number;
}

export interface PricedItem {
  price: string;
  discount: Discount | null;
}

export interface Modifier {
  price: string;
  quantity: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getOriginalPrice(item: PricedItem): number {
  return Number(item.price);
}

export function getEffectivePrice(item: PricedItem): number {
  const base = getOriginalPrice(item);
  if (!item.discount) return base;

  switch (item.discount.type) {
    case 'percentage':
      return round2(base * (1 - (item.discount.value ?? 0) / 100));
    case 'fixed':
      return round2(Math.max(0, base - (item.discount.value ?? 0)));
    case 'bogo':
    case 'tiered':
      // These discounts apply at line level, not unit level
      return base;
    default:
      return base;
  }
}

export function hasUnitDiscount(item: PricedItem): boolean {
  if (!item.discount) return false;
  return item.discount.type === 'percentage' || item.discount.type === 'fixed';
}

export function getDiscountLabel(item: PricedItem, currency: string, locale: string): string {
  if (!item.discount) return '';

  switch (item.discount.type) {
    case 'percentage':
      return `-${item.discount.value}%`;
    case 'fixed':
      return `${formatPrice(String(item.discount.value ?? 0), currency, locale)} off`;
    case 'bogo':
      return `Buy ${item.discount.buyQuantity} Get ${item.discount.getQuantity} Free`;
    case 'tiered':
      return `${item.discount.quantity} for ${formatPrice(String(item.discount.price ?? 0), currency, locale)}`;
    default:
      return '';
  }
}

function getModifierTotal(modifiers?: Modifier[]): number {
  if (!modifiers || modifiers.length === 0) return 0;
  return modifiers.reduce((sum, mod) => sum + Number(mod.price) * mod.quantity, 0);
}

export function getLineTotal(item: PricedItem, qty: number, modifiers?: Modifier[]): number {
  const modTotal = getModifierTotal(modifiers);

  if (item.discount) {
    switch (item.discount.type) {
      case 'bogo': {
        const buy = item.discount.buyQuantity ?? 1;
        const get = item.discount.getQuantity ?? 1;
        const paidItems = qty - Math.floor(qty / (buy + get)) * get;
        return round2((getOriginalPrice(item) + modTotal) * paidItems);
      }
      case 'tiered': {
        if (qty >= (item.discount.quantity ?? 0)) {
          return round2(item.discount.price ?? 0);
        }
        return round2((getOriginalPrice(item) + modTotal) * qty);
      }
      default:
        return round2((getEffectivePrice(item) + modTotal) * qty);
    }
  }

  return round2((getOriginalPrice(item) + modTotal) * qty);
}

export function getLineSavings(item: PricedItem, qty: number, modifiers?: Modifier[]): number {
  const fullPrice = round2((getOriginalPrice(item) + getModifierTotal(modifiers)) * qty);
  const discountedPrice = getLineTotal(item, qty, modifiers);
  return round2(fullPrice - discountedPrice);
}
