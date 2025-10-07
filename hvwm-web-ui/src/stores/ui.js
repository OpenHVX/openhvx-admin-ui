import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    isDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    _inited: false
  }),
  actions: {
    initThemeWatcher() {
      if (this._inited) return
      this._inited = true
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e) => { this.isDark = e.matches }
      // support moderne
      if (mq.addEventListener) mq.addEventListener('change', handler)
      // fallback Safari vieux
      else mq.addListener && mq.addListener(handler)
    },
    toggleDark() { this.isDark = !this.isDark }
  }
})