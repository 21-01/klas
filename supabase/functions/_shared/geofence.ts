export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    throw new Error("Invalid IPv4 address format");
  }
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

export function isIpInSubnet(ip: string, cidr: string): boolean {
  try {
    const [subnet, maskStr] = cidr.split("/");
    const mask = maskStr ? Number(maskStr) : 32;
    const ipInt = ipToInt(ip);
    const subnetInt = ipToInt(subnet);
    const maskInt = mask === 0 ? 0 : ~0 << (32 - mask);
    return (ipInt & maskInt) === (subnetInt & maskInt);
  } catch {
    return false;
  }
}
