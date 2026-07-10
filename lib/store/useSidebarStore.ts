// lib/store/useSidebarStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (value: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((state) => ({ collapsed: !state.collapsed })),
      setCollapsed: (value) => set({ collapsed: value }),
    }),
    { name: 'tasklync-admin-sidebar' }
  )
)