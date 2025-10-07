<!-- /src/components/console/serial/SerialConsole.vue -->
<script setup>
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const props = defineProps({
  wsUrl: { type: String, default: null },
  autoFocus: { type: Boolean, default: true },
  fontSize: { type: Number, default: 13 },
  theme: {
    type: Object,
    default: () => ({
      background: "#0b0f13",
      foreground: "#d5dde6",
      cursor: "#a7b3c2",
      black: "#0b0f13",
      red: "#ff6b6b",
      green: "#22c55e",
      yellow: "#eab308",
      blue: "#60a5fa",
      magenta: "#c084fc",
      cyan: "#22d3ee",
      white: "#e5e7eb",
      brightBlack: "#6b7280",
    }),
  },
});

// ➜ added "reconnect" event
const emit = defineEmits([
  "connected",
  "disconnected",
  "traffic",
  "closed",
  "reconnect",
]);

const termEl = ref(null);
let term, fit, ws, ro, keepAlive;
const state = ref({ connected: false, connecting: false });
const stats = { in: 0, out: 0 };
// create decoder once (avoid re-allocating per message)
const decoder = new TextDecoder("utf-8");

function resize() {
  try {
    fit && fit.fit();
    term && term.focus();
  } catch {}
}

function cleanupSocket() {
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
  try {
    ws && ws.close();
  } catch {}
  ws = null;
  state.value.connected = false;
}

function doConnect(url) {
  cleanupSocket();
  if (!url) return;

  state.value.connecting = true;
  ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    state.value.connecting = false;
    state.value.connected = true;
    emit("connected");
    try {
      // send a couple of CR to wake the console
      ws.send(new Uint8Array([13]));
      setTimeout(() => ws?.send(new Uint8Array([13])), 150);
    } catch {}
    keepAlive = setInterval(() => {
      try {
        ws?.send("\u0000"); // NUL keep-alive
      } catch {}
    }, 30000);
  };

  ws.onmessage = (ev) => {
    if (!term) return;
    if (ev.data instanceof ArrayBuffer) {
      const u8 = new Uint8Array(ev.data);
      stats.in += u8.length;
      emit("traffic", { dir: "in", bytes: u8.length, total: { ...stats } });
      term.write(decoder.decode(u8));
    } else {
      const s = String(ev.data);
      stats.in += s.length;
      emit("traffic", { dir: "in", bytes: s.length, total: { ...stats } });
      term.write(s);
    }
  };

  ws.onclose = () => {
    cleanupSocket();
    term && term.write("\r\n\x1b[31m[disconnected]\x1b[0m\r\n");
    emit("disconnected");
    emit("reconnect");
    emit("closed");
  };

  ws.onerror = () => {};
}

onMounted(async () => {
  term = new Terminal({
    cursorBlink: true,
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: props.fontSize,
    convertEol: true,
    disableStdin: false,
    scrollback: 10000,
    theme: props.theme,
  });
  fit = new FitAddon();
  term.loadAddon(fit);
  term.open(termEl.value);
  await nextTick();
  resize();

  ro = new ResizeObserver(resize);
  ro.observe(termEl.value);

  term.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
        stats.out += data.length;
        emit("traffic", {
          dir: "out",
          bytes: data.length,
          total: { ...stats },
        });
      } catch {}
    }
  });

  // Shortcuts: Ctrl+K clear; Ctrl+R ask parent to reconnect
  term.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "KeyK") {
      term.clear();
      return false;
    }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "KeyR") {
      term.write("\r\n\x1b[33m[reconnect requested]\x1b[0m\r\n");
      emit("reconnect");
      return false;
    }
    return true;
  });

  if (props.autoFocus) term.focus();
  if (props.wsUrl) {
    term.write("\x1b[32m[connecting…]\x1b[0m\r\n");
    doConnect(props.wsUrl);
  } else {
    term.write("\x1b[33m[no wsUrl]\x1b[0m\r\n");
  }
});

onBeforeUnmount(() => {
  cleanupSocket();
  ro && ro.disconnect();
  term && term.dispose();
  term = null;
  fit = null;
  ro = null;
});

watch(
  () => props.wsUrl,
  (url) => {
    stats.in = 0;
    stats.out = 0;
    if (!term) return;
    term.reset();
    resize();
    if (url) {
      term.write("\x1b[32m[connecting…]\x1b[0m\r\n");
      doConnect(url);
    } else {
      term.write("\x1b[33m[no wsUrl]\x1b[0m\r\n");
    }
  }
);

watch(
  () => props.fontSize,
  (n) => {
    if (term) {
      term.options.fontSize = n;
      resize();
    }
  }
);

const api = {
  focus: () => term?.focus(),
  clear: () => term?.clear(),
  copySelection: async () => {
    const s = term?.getSelection() || "";
    if (s) await navigator.clipboard.writeText(s);
  },
  pasteFromClipboard: async () => {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(text);
      stats.out += text.length;
      emit("traffic", { dir: "out", bytes: text.length, total: { ...stats } });
    }
  },
  // Force a connection if the caller already has a new URL
  connect: (newUrl) => {
    if (newUrl) {
      term?.reset();
      resize();
      term?.write("\x1b[32m[connecting…]\x1b[0m\r\n");
      doConnect(newUrl);
    } else {
      emit("reconnect"); // ask parent to generate a fresh URL
    }
  },
  // Convenience alias: trigger a reconnect request
  reconnect: () => emit("reconnect"),
};
defineExpose(api);
</script>

<template>
  <div class="serial-terminal">
    <div ref="termEl" class="term"></div>
  </div>
</template>

<style scoped>
.serial-terminal,
.term {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
.term {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
}
</style>
