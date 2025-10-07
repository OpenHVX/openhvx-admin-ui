<!-- /src/layouts/AdminShell.vue -->
<template>
  <n-layout has-sider class="admin-shell" style="height: 100dvh; width: 100%">
    <!-- Sidebar -->
    <n-layout-sider
      v-model:collapsed="collapsed"
      collapse-mode="width"
      :collapsed-width="64"
      :width="240"
      bordered
      :native-scrollbar="false"
      class="sider"
    >
      <div class="brand" @click="go('/admin/dashboard')" :title="appTitle">
        <div class="brand-logo">OpenHVX</div>
        <div class="brand-sub" v-if="!collapsed">Admin</div>
      </div>

      <n-menu
        :value="activeKey"
        :options="menuOptions"
        :collapsed="collapsed"
        @update:value="onSelect"
      />
    </n-layout-sider>

    <!-- Main area -->
    <n-layout style="height: 100%">
      <!-- Topbar -->
      <n-layout-header bordered class="header">
        <div class="left">
          <n-button
            quaternary
            circle
            @click="collapsed = !collapsed"
            title="Toggle menu"
            aria-label="Toggle menu"
          >
            <n-icon :component="MenuOutline" />
          </n-button>
          <div class="divider" />
          <div class="title">Global Admin</div>
        </div>

        <div class="right">
          <n-input
            v-model:value="q"
            placeholder="Search…"
            clearable
            size="small"
            style="max-width: 280px"
          />
          <n-button
            quaternary
            circle
            :title="ui.isDark ? 'Light mode' : 'Dark mode'"
            :aria-label="ui.isDark ? 'Light mode' : 'Dark mode'"
            @click="ui.toggleDark()"
          >
            <n-icon :component="ui.isDark ? SunnyOutline : MoonOutline" />
          </n-button>

          <n-dropdown
            :options="userDropdown"
            trigger="click"
            @select="onUserSelect"
          >
            <div class="user">
              <n-avatar round size="small">{{ initials }}</n-avatar>
              <div class="who" v-if="!compactHeader">
                <div class="name">{{ userName }}</div>
                <div class="mail">{{ userEmail }}</div>
              </div>
            </div>
          </n-dropdown>
        </div>
      </n-layout-header>

      <!-- Content -->
      <n-layout-content content-style="padding: 16px;">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

// Naive UI
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NButton,
  NIcon,
  NInput,
  NDropdown,
  NAvatar,
} from "naive-ui";
import { MoonOutline, SunnyOutline, MenuOutline } from "@vicons/ionicons5";

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const ui = useUiStore();

const appTitle = "Hyper-V Web Manager";
const collapsed = ref(false);
const q = ref("");

// Menu
const menuOptions = [
  { label: "Dashboard", key: "/admin/dashboard" },
  { label: "Agents", key: "/admin/agents" },
  { label: "Tenants", key: "/admin/tenants" },
  { label: "Unassigned", key: "/admin/unassigned" },
];

const activeKey = ref(route.matched.at(-1)?.path || route.path);
watch(
  () => route.fullPath,
  () => {
    activeKey.value = route.matched.at(-1)?.path || route.path;
  }
);

function onSelect(key) {
  go(key);
}
function go(path) {
  if (route.fullPath !== path) router.push(path);
}

// User
const userName = computed(() => auth.user?.name || "Global Admin");
const userEmail = computed(() => auth.user?.email || "");
const initials = computed(() => {
  const n = userName.value?.trim() || "";
  const parts = n.split(/\s+/);
  const i1 = parts[0]?.[0] || "";
  const i2 = parts[1]?.[0] || "";
  return (i1 + i2 || "GA").toUpperCase();
});
const compactHeader = computed(() => collapsed.value);

// Dropdown made reactive
const userDropdown = computed(() => [
  { label: userEmail.value || "Profile", key: "noop", disabled: true },
  { type: "divider" },
  { label: "Sign out", key: "logout" },
]);

function onUserSelect(key) {
  if (key === "logout") {
    auth.logout();
    router.replace("/login");
  }
}
</script>

<style scoped>
.admin-shell {
  min-height: 100%;
}

/* Sider */
.sider {
  display: flex;
  flex-direction: column;
}
.brand {
  display: grid;
  gap: 2px;
  padding: 16px 14px;
  cursor: pointer;
  user-select: none;
}
.brand-logo {
  font-weight: 800;
  letter-spacing: 0.2px;
}
.brand-sub {
  opacity: 0.7;
  font-size: 12px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
}
.header .left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header .right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header .divider {
  width: 1px;
  height: 20px;
  background: var(--n-border-color);
}
.header .title {
  font-weight: 700;
}

/* User pill */
.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 999px;
  cursor: pointer;
}
.user:hover {
  background: rgba(127, 127, 127, 0.12);
}
.who {
  display: grid;
  line-height: 1.1;
}
.who .name {
  font-size: 12px;
  font-weight: 600;
}
.who .mail {
  font-size: 11px;
  opacity: 0.7;
}

/* Responsive */
@media (max-width: 900px) {
  .brand-sub,
  .who {
    display: none;
  }
}
</style>
