import { create } from 'zustand';

interface PendingRoom {
  roomId: string;
  roomNumber: string;
}

interface CustomerRoomState {
  pendingRoom: PendingRoom | null;
  setPendingRoom: (roomId: string, roomNumber: string) => void;
  clearPendingRoom: () => void;
}

export const useCustomerRoomStore = create<CustomerRoomState>((set) => ({
  pendingRoom: null,
  setPendingRoom: (roomId, roomNumber) => set({ pendingRoom: { roomId, roomNumber } }),
  clearPendingRoom: () => set({ pendingRoom: null }),
}));
