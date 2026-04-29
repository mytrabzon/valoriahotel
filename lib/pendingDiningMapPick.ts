export type DiningMapPickResult = { lat: number; lng: number; address: string };

let pending: DiningMapPickResult | null = null;

export function setPendingDiningMapPick(r: DiningMapPickResult) {
  pending = r;
}

export function takePendingDiningMapPick(): DiningMapPickResult | null {
  const x = pending;
  pending = null;
  return x;
}
