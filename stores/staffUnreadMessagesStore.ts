import { create } from 'zustand';
import { staffListConversations } from '@/lib/messagingApi';

interface StaffUnreadState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  refreshUnread: (staffId: string) => Promise<void>;
}

export const useStaffUnreadMessagesStore = create<StaffUnreadState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  refreshUnread: async (staffId) => {
    const list = await staffListConversations(staffId);
    const total = list.reduce((s, c) => s + (c.unread_count ?? 0), 0);
    set({ unreadCount: total });
  },
}));
