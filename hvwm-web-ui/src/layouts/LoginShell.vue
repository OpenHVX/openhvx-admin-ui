<!-- /src/layouts/LoginShell.vue -->
<template>
  <div class="login-shell">
    <!-- Brand (hidden under < 900px) -->
    <aside v-if="showBrand" class="brand-pane">
      <div class="brand-wrap">
        <slot name="brand">
          <div class="logo">OpenHVX</div>
          <div class="tag">Hyper-V IaaS Platform</div>
        </slot>
      </div>
    </aside>

    <!-- Form area -->
    <main class="form-pane">
      <n-card :bordered="true" size="large" class="card">
        <div class="card-header">
          <div class="title">
            <slot name="title">
              <h1>Sign in</h1>
              <p>Authenticate to continue</p>
            </slot>
          </div>

          <n-button
            quaternary
            circle
            @click="ui.toggleDark()"
            :title="ui.isDark ? 'Light mode' : 'Dark mode'"
            :aria-label="ui.isDark ? 'Light mode' : 'Dark mode'"
          >
            <!-- Tip: pass icon via the 'component' prop -->
            <n-icon v-if="!ui.isDark" :component="MoonOutline" />
            <n-icon v-else :component="SunnyOutline" />
          </n-button>
        </div>

        <div class="card-content">
          <slot />
        </div>

        <div class="card-footer">
          <slot name="footer">
            <span class="muted"
              >Forgot your password? Contact your administrator.</span
            >
          </slot>
        </div>
      </n-card>
    </main>
  </div>
</template>

<script setup>
import { NCard, NButton, NIcon } from "naive-ui"; // if using unplugin-vue-components, you can remove this line
import { useUiStore } from "@/stores/ui";
import { MoonOutline, SunnyOutline } from "@vicons/ionicons5";

const props = defineProps({
  showBrand: { type: Boolean, default: true },
});

const ui = useUiStore();
</script>

<style scoped>
/* ------- Quick tuning variables ------- */
.login-shell {
  /* left gradient area width */
  --brand-w: 38vw; /* adjust 34–42vw to taste */
  /* horizontal shift of the card (overlaps the column boundary) */
  --card-shift-x: -9vw; /* tweak between -6 and -12vw */
  /* subtle vertical shift */
  --card-shift-y: -2vh; /* tweak between -3 and +2vh */
  /* max card width */
  --card-max: 480px;
}

/* Global grid: left column (gradient) + right column */
.login-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(420px, var(--brand-w)) 1fr;
  overflow: hidden;
}

/* ===== Left column (background + halos) ===== */
.brand-pane {
  position: relative;
  border-right: 1px solid var(--n-border-color);
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 64px;
  overflow: hidden;
  background: linear-gradient(180deg, #0c1120 0%, #0a0e19 100%);
}
.brand-pane::before {
  content: "";
  position: absolute;
  inset: -15% -10%;
  background: radial-gradient(
      760px 560px at 22% 18%,
      rgba(99, 102, 241, 0.22),
      transparent 64%
    ),
    radial-gradient(
      680px 520px at 78% 88%,
      rgba(16, 185, 129, 0.12),
      transparent 70%
    );
  filter: blur(10px);
  z-index: 0;
}
.brand-wrap {
  position: relative;
  z-index: 1;
  max-width: 360px;
  text-align: center;
  color: #eeeeee;
}
.logo {
  font-size: 40px;
  font-weight: 800;
  margin-bottom: 6px;
}
.tag {
  opacity: 0.8;
}

.form-pane {
  display: grid;
  align-items: center;
  justify-items: start;
  padding: 6vh 5vw;
}
.card {
  width: 100%;
  max-width: var(--card-max);
  backdrop-filter: saturate(120%);
  transform: translate(var(--card-shift-x), var(--card-shift-y));
  will-change: transform;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.title h1 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
}
.title p {
  margin: 0;
  opacity: 0.72;
}
.card-content {
  display: grid;
  gap: 14px;
}
.card-footer {
  margin-top: 6px;
}
.muted {
  opacity: 0.7;
  font-size: 12px;
}
:root.dark .logo,
body.dark .logo {
  color: #eeeeee;
}

@media (max-width: 1600px) {
  .login-shell {
    --brand-w: 36vw;
    --card-shift-x: -7vw;
    --card-shift-y: -1.5vh;
  }
}
@media (max-width: 1400px) {
  .login-shell {
    --brand-w: 34vw;
    --card-shift-x: -5.5vw;
    --card-shift-y: -1vh;
  }
}
@media (max-width: 1200px) {
  .login-shell {
    --card-shift-x: -4vw;
    --card-shift-y: 0;
  }
}
@media (max-width: 1100px) {
  .login-shell {
    --card-shift-x: 0;
    --card-shift-y: 0;
  }
  .form-pane {
    justify-items: center;
    padding: 40px;
  }
}

@media (max-width: 900px) {
  .login-shell {
    grid-template-columns: 1fr;
  }
  .brand-pane {
    display: none;
  }
  .form-pane {
    padding: 24px;
    justify-items: center;
  }
  .card {
    transform: none;
    max-width: 420px;
  }
}
</style>
