import {
  $addressCoords,
  $addressEligibility,
  setStoredAddress,
  clearStoredAddress,
  getStoredAddress,
} from './address';
import { $cart, getStoredCartId, errorDetail } from './cart';
import { getClient } from '@/lib/api';
import { normalizeCart } from '@/lib/normalize';
import type { AddressCoords, AddressEligibility } from '@/types/address';

export async function onAddressChange(input: {
  postalCode: string;
  country: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();
    const { data, error } = await client.POST('/api/v1/fulfillment/address-check/', {
      body: { postal_code: input.postalCode, country: input.country },
    });

    if (error || !data) {
      return { success: false, error: errorDetail(error) };
    }

    const r = data as Record<string, unknown>;
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return { success: false, error: 'invalid_response' };
    }

    const coords: AddressCoords = {
      postalCode: input.postalCode,
      country: input.country,
      latitude: lat,
      longitude: lng,
    };

    const pickupLocations = Array.isArray(r.pickup_locations)
      ? r.pickup_locations.filter(
          (l: unknown): l is { id: number; name: string; distance_km: number } =>
            !!l && typeof l === 'object' && 'name' in l,
        )
      : [];

    const eligibility: AddressEligibility = {
      availableFulfillmentTypes: Array.isArray(r.available_fulfillment_types)
        ? r.available_fulfillment_types
        : [],
      availableShippingProviders: Array.isArray(r.available_shipping_providers)
        ? r.available_shipping_providers
        : [],
      pickupLocations,
      deliveryUnavailable: r.delivery_unavailable === true,
      nearDeliveryZone: r.near_delivery_zone === true,
      nearestPickupLocation:
        pickupLocations.length > 0
          ? { name: pickupLocations[0].name, distance_km: pickupLocations[0].distance_km }
          : undefined,
    };

    // 1. Set stores
    $addressCoords.set(coords);
    $addressEligibility.set(eligibility);

    // 2. Persist coords to localStorage
    setStoredAddress(coords);

    // 3. Inline analytics: track address_entered
    trackAddressEntered(coords, eligibility);

    // 4. Track delivery unavailable if applicable
    if (eligibility.deliveryUnavailable) {
      trackDeliveryUnavailable(coords, eligibility);
    }

    // 5. Re-fetch cart with coordinates if cart exists
    const cartId = getStoredCartId();
    if (cartId) {
      await refreshCartWithCoords(cartId, coords);
    }

    return { success: true };
  } catch {
    return { success: false, error: 'network' };
  }
}

export function clearAddress(): void {
  $addressCoords.set(null);
  $addressEligibility.set(null);
  clearStoredAddress();
}

/** Uses normalizeCart() to maintain boundary normalization invariant */
async function refreshCartWithCoords(cartId: string, coords: AddressCoords): Promise<void> {
  try {
    const client = getClient();
    const { data } = await client.GET('/api/v1/cart/{cart_id}/', {
      params: {
        path: { cart_id: cartId },
        query: { latitude: coords.latitude, longitude: coords.longitude },
      },
    });
    if (data) {
      $cart.set(normalizeCart(data as Record<string, unknown>));
    }
  } catch {
    // Cart refresh failure is non-blocking — estimate just won't show
  }
}

export async function hydrateAddressFromStorage(): Promise<void> {
  const stored = getStoredAddress();
  if (!stored) return;

  // Set coords immediately (stable data, OK to use from cache)
  $addressCoords.set({
    postalCode: stored.postalCode,
    country: stored.country,
    latitude: stored.latitude,
    longitude: stored.longitude,
  });

  // Re-fetch volatile eligibility data in background
  await onAddressChange({
    postalCode: stored.postalCode,
    country: stored.country,
  });
}

// ── Inline Analytics ───────────────────────────────────────────
// Inlined here instead of a separate module — only 2 events at launch.

function truncatePostcode(postalCode: string): string {
  return postalCode.replace(/\s/g, '').slice(0, 4);
}

function capture(event: string, properties: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'posthog' in window) {
    (
      window as unknown as {
        posthog?: { capture: (e: string, p: Record<string, unknown>) => void };
      }
    ).posthog?.capture(event, properties);
  }
}

function trackAddressEntered(coords: AddressCoords, eligibility: AddressEligibility): void {
  capture('address_entered', {
    postal_code_prefix: truncatePostcode(coords.postalCode),
    country: coords.country,
    available_fulfillment_types: eligibility.availableFulfillmentTypes,
    has_local_delivery: eligibility.availableFulfillmentTypes.includes('local_delivery'),
    has_pickup: eligibility.availableFulfillmentTypes.includes('pickup'),
  });
}

function trackDeliveryUnavailable(coords: AddressCoords, eligibility: AddressEligibility): void {
  capture('delivery_unavailable', {
    postal_code_prefix: truncatePostcode(coords.postalCode),
    country: coords.country,
    nearest_pickup_distance_km: eligibility.nearestPickupLocation?.distance_km ?? null,
    near_delivery_zone: eligibility.nearDeliveryZone,
  });
}
