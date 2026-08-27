import { env } from '@/config/env';

const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const TIMEOUT_MS = 4000;

/**
 * Reverse-geocodes coordinates into a human-readable address using Google's
 * Geocoding API. Never throws — a geocoding failure must never block a
 * registration from being saved, so any error just resolves to null.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!env.googleMapsApiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${GOOGLE_GEOCODE_URL}?latlng=${lat},${lng}&key=${env.googleMapsApiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    const json = await res.json();

    if (json.status !== 'OK' || !json.results?.length) return null;

    return json.results[0].formatted_address as string;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}