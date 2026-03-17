/**
 * Anasayfa / Ana Sayfa sekmesine tıklandığında scroll'u yukarı kaydırmak için.
 * İlgili ekran (customer anasayfa, lobi vb.) mount'ta setScrollToTop ile callback kaydeder.
 */
import { create } from 'zustand';

interface ScrollToTopState {
  scrollToTop: (() => void) | null;
  setScrollToTop: (fn: (() => void) | null) => void;
}

export const useScrollToTopStore = create<ScrollToTopState>((set) => ({
  scrollToTop: null,
  setScrollToTop: (fn) => set({ scrollToTop: fn }),
}));
