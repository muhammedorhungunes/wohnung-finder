type Coords = { lat: number; lon: number };

const cache = new Map<string, Coords | null>();
let lastRequestAt = 0;
const RATE_LIMIT_MS = 1100; // Nominatim: max 1 req/sec

export async function geocodeQuery(query: string): Promise<Coords | null> {
  const key = query.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;

  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestAt = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'wohnung-finder/1.0' } });
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const result = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export function extractPostalCode(address: string): string | null {
  const match = address.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}
