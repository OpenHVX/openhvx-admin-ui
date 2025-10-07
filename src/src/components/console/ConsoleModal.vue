<!-- /src/components/console/SerialModal.vue -->
<script setup>
import { computed, ref, watch } from "vue";
import {
  NModal,
  NCard,
  NSpace,
  NButton,
  NIcon,
  NTag,
  NTooltip,
  NDivider,
  NStatistic,
  NSpin,
  NEllipsis, // ✅ added
} from "naive-ui";
import {
  Terminal as IconTerminal,
  RefreshOutline,
  CloseOutline,
  CopyOutline,
  ClipboardOutline,
  SearchOutline,
  ResizeOutline,
  TrashOutline,
  RemoveOutline,
  AddOutline,
} from "@vicons/ionicons5";
import SerialTerminal from "./serial/SerialConsole.vue";

const props = defineProps({
  show: { type: Boolean, default: false },
  vmName: { type: String, default: "" },
  tunnelId: { type: String, default: "" },
  expiresAt: { type: String, default: "" }, // ISO
  wsUrl: { type: String, default: null },
});

const emit = defineEmits(["update:show", "closed", "reconnect"]);

const fontSize = ref(13);
const connecting = ref(true);
const connected = ref(false);
const bytesIn = ref(0);
const bytesOut = ref(0);
const fullscreen = ref(false);

const ttlLabel = computed(() => {
  if (!props.expiresAt) return "—";
  const ms = new Date(props.expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
});

const termRef = ref(null); // ✅ was a plain variable; make it a ref

function onTraffic({ dir, bytes, total }) {
  bytesIn.value = total.in;
  bytesOut.value = total.out;
}
function onConnected() {
  connecting.value = false;
  connected.value = true;
}
function onDisconnected() {
  connected.value = false;
}
function doReconnect() {
  connecting.value = true;
  bytesIn.value = 0;
  bytesOut.value = 0;
  emit("reconnect"); // parent refreshes wsUrl (new ticket) if needed
}
function close() {
  emit("update:show", false);
  emit("closed");
}
function copySel() {
  termRef.value?.copySelection();
}
function pasteClip() {
  termRef.value?.pasteFromClipboard();
}
function clearTerm() {
  termRef.value?.clear();
}
function fsToggle() {
  fullscreen.value = !fullscreen.value;
}

watch(
  () => props.show,
  (v) => {
    if (v) {
      connecting.value = true;
      connected.value = false;
      bytesIn.value = 0;
      bytesOut.value = 0;
    }
  }
);
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="false"
    :auto-focus="false"
    @update:show="$emit('update:show', $event)"
  >
    <NCard
      :style="{
        width: fullscreen ? '96vw' : '860px',
        maxWidth: '96vw',
        height: fullscreen ? '88vh' : '520px',
        display: 'flex',
        flexDirection: 'column',
      }"
      size="small"
      :bordered="false"
    >
      <!-- Header -->
      <div class="header">
        <!-- LEFT: title + badges -->
        <div class="title">
          <NIcon size="18" class="muted"><IconTerminal /></NIcon>

          <!-- VM name with ellipsis & hover title -->
          <NEllipsis class="vm-name" :line-clamp="1">
            <span :title="vmName">
              Console — <strong>{{ vmName || "VM" }}</strong>
            </span>
          </NEllipsis>

          <!-- Badges in a wrapping row -->
          <div class="badges">
            <NTag size="small" round :type="connected ? 'success' : 'warning'">
              {{
                connected ? "connected" : connecting ? "connecting…" : "offline"
              }}
            </NTag>
            <NTag v-if="tunnelId" size="small" round type="info">
              #{{ tunnelId.slice(-8) }}
            </NTag>
            <NTag v-if="expiresAt" size="small" round type="default">
              expires {{ ttlLabel }}
            </NTag>
          </div>
        </div>

        <!-- RIGHT: controls (don’t shrink) -->
        <NSpace :size="6" align="center" wrap class="controls">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                @click="doReconnect"
                aria-label="Reconnect"
              >
                <NIcon><RefreshOutline /></NIcon>
              </NButton>
            </template>
            Reconnect
          </NTooltip>

          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                @click="clearTerm"
                aria-label="Clear terminal"
              >
                <NIcon><TrashOutline /></NIcon>
              </NButton>
            </template>
            Clear
          </NTooltip>

          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                @click="copySel"
                aria-label="Copy selection"
              >
                <NIcon><CopyOutline /></NIcon>
              </NButton>
            </template>
            Copy selection
          </NTooltip>

          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                @click="pasteClip"
                aria-label="Paste from clipboard"
              >
                <NIcon><ClipboardOutline /></NIcon>
              </NButton>
            </template>
            Paste
          </NTooltip>

          <NDivider vertical />

          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                @click="() => (fontSize = Math.max(10, fontSize - 1))"
                aria-label="Decrease font size"
              >
                <NIcon><RemoveOutline /></NIcon>
              </NButton>
            </template>
            Font -
          </NTooltip>

          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                @click="() => (fontSize = Math.min(22, fontSize + 1))"
                aria-label="Increase font size"
              >
                <NIcon><AddOutline /></NIcon>
              </NButton>
            </template>
            Font +
          </NTooltip>

          <NDivider vertical />

          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                quaternary
                @click="fsToggle"
                aria-label="Toggle fullscreen"
              >
                <NIcon><ResizeOutline /></NIcon>
              </NButton>
            </template>
            Maximize
          </NTooltip>

          <NDivider vertical />

          <NButton
            size="small"
            tertiary
            @click="close"
            aria-label="Close modal"
          >
            <template #icon
              ><NIcon><CloseOutline /></NIcon
            ></template>
            Close
          </NButton>
        </NSpace>
      </div>

      <!-- Body -->
      <div class="body">
        <NSpin :show="connecting" description="Connecting…">
          <SerialTerminal
            ref="termRef"
            :ws-url="wsUrl"
            :font-size="fontSize"
            @connected="onConnected"
            @disconnected="onDisconnected"
            @traffic="onTraffic"
          />
        </NSpin>
      </div>

      <!-- Footer -->
      <div class="footer">
        <NSpace :size="16">
          <NStatistic label="Inbound" :value="bytesIn">
            <template #suffix> B</template>
          </NStatistic>
          <NStatistic label="Outbound" :value="bytesOut">
            <template #suffix> B</template>
          </NStatistic>
        </NSpace>
      </div>
    </NCard>
  </NModal>
</template>

<style scoped>
/* Header becomes a responsive two-column grid */
.header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 8px;
}

/* Stack on narrow viewports */
@media (max-width: 760px) {
  .header {
    grid-template-columns: 1fr;
    align-items: start;
  }
}

/* Title row: allow shrinking text, but keep buttons intact */
.title {
  min-width: 0; /* critical: allow ellipsis to work in flex/grid */
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  flex-wrap: wrap; /* lets badges wrap under the name if needed */
}

.title .muted {
  opacity: 0.8;
}

/* VM name should ellipsize rather than push controls off-screen */
.vm-name {
  min-width: 0;
  max-width: clamp(140px, 32vw, 520px);
}

/* Badges can wrap to a new line on small spaces */
.badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* Keep the controls from shrinking, but allow wrapping if too many */
.controls {
  flex: none;
}

/* Body/Footer unchanged */
.body {
  position: relative;
  flex: 1;
  min-height: 320px;
  background: #0b0f13;
  border-radius: 10px;
  padding: 6px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.footer {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  font-variant-numeric: tabular-nums;
}
</style>
