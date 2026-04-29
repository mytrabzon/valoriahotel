export type TransferTourMapPickResult = { lat: number; lng: number; address: string };

let pending: TransferTourMapPickResult | null = null;

export function setPendingTransferTourMapPick(r: TransferTourMapPickResult) {
  pending = r;
}

export function takePendingTransferTourMapPick(): TransferTourMapPickResult | null {
  const x = pending;
  pending = null;
  return x;
}
