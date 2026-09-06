import { JournalLocation } from '../types';

export interface GeolocationResult {
  location: JournalLocation | null;
  error: string | null;
}

export async function requestCurrentLocation(): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    return {
      location: null,
      error: 'Geolocation is not supported by your browser.',
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const response = await fetch(
            `/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
          );

          if (response.ok) {
            const data = await response.json();
            resolve({
              location: {
                latitude: lat,
                longitude: lng,
                city: data.city || undefined,
                region: data.region || undefined,
                country: data.country || undefined,
                placeName: data.placeName || `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
              },
              error: null,
            });
            return;
          }
        } catch (fetchErr) {
          console.warn('Failed to reverse geocode via server, using coordinates:', fetchErr);
        }

        // Coordinate fallback
        const latLabel = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
        const lngLabel = `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;
        resolve({
          location: {
            latitude: lat,
            longitude: lng,
            placeName: `${latLabel}, ${lngLabel}`,
          },
          error: null,
        });
      },
      (err) => {
        let msg = 'Unable to determine location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access in your browser to geotag reflections.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out.';
        }
        resolve({
          location: null,
          error: msg,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
