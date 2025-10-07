ici peut être?
<template>
  <n-config-provider :theme="theme" :theme-overrides="overrides">
    <n-global-style />
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <n-message-provider>
            <router-view />
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, watchEffect, onMounted } from "vue";
import { darkTheme } from "naive-ui";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const theme = computed(() => (ui.isDark ? darkTheme : null));
const overrides = {
  common: {
    primaryColor: "#0ea5e9", // sky-500 vibe
  },
};

onMounted(() => ui.initThemeWatcher());

// (optionnel) met à jour <meta name="theme-color">
watchEffect(() => {
  const m =
    document.querySelector('meta[name="theme-color"]') ||
    document.createElement("meta");
  m.setAttribute("name", "theme-color");
  m.setAttribute("content", ui.isDark ? "#0b0b0b" : "#ffffff");
  if (!m.parentNode) document.head.appendChild(m);
});
</script>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
</style>
