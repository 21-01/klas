/** Haversine distance in meters (same math as the old edge functions). */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function ipToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) throw new Error("Invalid IPv4 address format");
  let int = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      throw new Error("Invalid IPv4 address format");
    }
    int = (int << 8) + octet;
  }
  return int >>> 0;
}

/** CIDR membership test; returns false on any malformed input. */
export function isIpInSubnet(ip: string, cidr: string): boolean {
  try {
    const [network, maskPart = "32"] = cidr.split("/");
    const mask = Number(maskPart);
    const maskInt = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
    return (ipToInt(ip) & maskInt) === (ipToInt(network) & maskInt);
  } catch {
    return false;
  }
}

export const DEFAULT_IP_WHITELIST = [
  "127.0.0.1/32",
  "192.168.0.0/16",
  "10.0.0.0/8",
  "172.16.0.0/12",
];
