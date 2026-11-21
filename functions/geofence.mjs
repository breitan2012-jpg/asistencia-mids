export const DEFAULT_GPS = { lat: 9.901419, lng: -84.029416, radius: 40 };

export function validAttendanceLocation(fix, config = DEFAULT_GPS) {
  if (!fix || ![fix.lat, fix.lng, fix.accuracy, fix.capturedAt].every(Number.isFinite)) return false;
  if (Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180 || fix.accuracy <= 0) return false;
  const { lat, lng, radius } = config ?? DEFAULT_GPS;
  if (![lat, lng, radius].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || radius <= 0) return false;
  const rad = Math.PI / 180;
  const a = Math.sin((lat - fix.lat) * rad / 2) ** 2 +
    Math.cos(fix.lat * rad) * Math.cos(lat * rad) * Math.sin((lng - fix.lng) * rad / 2) ** 2;
  const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  return distance + fix.accuracy <= Math.min(40, radius);
}
