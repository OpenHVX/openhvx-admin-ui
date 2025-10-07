<!-- src/views/admin/TenantResources.vue -->
<template>
  <div class="page">
    <!-- ===== Toolbar (title, quick actions) ===== -->
    <page-toolbar
      :title="`Resources — ${tenantId}`"
      :subtitle="overviewSubtitle"
      :show-divider="true"
    >
      <template #badges>
        <n-tag round size="small" type="info">{{ tenantId }}</n-tag>
      </template>

      <template #actions>
        <n-space :size="8" wrap>
          <CreateVMButton
            :tenant-id="tenantId"
            :agents="agentOptions"
            @created="refreshAll"
            :can-create="true"
          />

          <n-input
            v-model:value="q"
            size="small"
            placeholder="Search (name, agent, IP)…"
            clearable
            style="max-width: 260px"
          >
            <template #prefix>
              <n-icon><SearchOutline /></n-icon>
            </template>
          </n-input>

          <n-button
            size="small"
            quaternary
            :loading="loading"
            @click="refreshAll"
            title="Refresh"
          >
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
            Refresh
          </n-button>
        </n-space>
      </template>
    </page-toolbar>

    <!-- ===== KPIs (tenant scope) ===== -->
    <n-grid
      responsive="screen"
      cols="1 s:2 m:3 l:4"
      x-gap="12"
      y-gap="12"
      class="kpi-grid"
    >
      <n-grid-item>
        <stat-card title="VMs (total)">
          {{ fmtInt(ov.vms.total) }}
          <template #footer>
            <div class="kpi-line">
              <span>Running: {{ fmtInt(ov.vms.byState.Running || 0) }}</span>
              <span>Off: {{ fmtInt(ov.vms.byState.Off || 0) }}</span>
              <span>Saved: {{ fmtInt(ov.vms.byState.Saved || 0) }}</span>
            </div>
          </template>
        </stat-card>
      </n-grid-item>

      <n-grid-item>
        <stat-card title="vCPU">{{ fmtInt(ov.compute.vcpus) }}</stat-card>
      </n-grid-item>

      <n-grid-item>
        <stat-card title="Provisioned RAM">
          <span v-if="ov.compute.memMB">
            {{ Math.round(ov.compute.memMB / 1024) }} GB
          </span>
          <span v-else>—</span>
        </stat-card>
      </n-grid-item>

      <n-grid-item>
        <stat-card title="Storage (used / provisioned)">
          {{ fmtBytes(ov.storage.usedMB * MB) }} /
          {{ fmtBytes(ov.storage.provisionedMB * MB) }}
          <template #footer>
            <n-progress
              type="line"
              :percentage="storagePct"
              :height="8"
              :indicator-placement="'inside'"
            >
              <template #default>
                <div style="font-size: 11px">{{ storagePct.toFixed(0) }}%</div>
              </template>
            </n-progress>
          </template>
        </stat-card>
      </n-grid-item>
    </n-grid>

    <!-- ===== VM table ===== -->
    <n-card size="small" :bordered="true" class="block">
      <template #header>
        <div class="card-head">
          <div>Virtual Machines</div>
        </div>
      </template>

      <n-data-table
        :loading="loading"
        :columns="cols"
        :data="filtered"
        :bordered="false"
        size="small"
        :row-key="rowKey"
        checkable
        @update:checked-row-keys="onSel"
      />
    </n-card>

    <!-- ===== Serial Console modal ===== -->
    <ConsoleModal
      :show="consoleOpen"
      :vm-name="consoleVm?.name"
      :tunnel-id="consoleInfo.tunnelId"
      :expires-at="consoleInfo.expiresAt"
      :ws-url="consoleWsUrl"
      @update:show="consoleOpen = $event"
      @reconnect="reconnectConsole"
      @closed="onConsoleClosed"
    />

    <!-- ===== Edit VM modal (opened programmatically) ===== -->
    <EditVMButton
      v-if="editVm"
      ref="editRef"
      :hide-trigger="true"
      :vm="editVm"
      :tenant-id="tenantId"
      :agent-id="editVm.agentId"
      @updated="refreshAll"
    />
  </div>
</template>

<script setup>
/*
  Tenant resources view (admin side).

  Notes:
  - Keep actions simple and discoverable from the row dropdown.
  - Only send the minimum data required to the API.
  - All labels/messages are English to match the rest of the admin UI.
*/
import {
  NGrid,
  NGridItem,
  NCard,
  NProgress,
  NDataTable,
  NButton,
  NSpace,
  NIcon,
  NTag,
  NInput,
  NDropdown,
  useDialog,
  useMessage,
} from "naive-ui";
import { h, computed, onMounted, ref, nextTick } from "vue";
import PageToolbar from "@/components/common/PageToolbar.vue";
import StatCard from "@/components/common/StatCard.vue";
import {
  SearchOutline,
  RefreshOutline,
  EllipsisHorizontal,
  TrashOutline,
  PowerSharp,
  TerminalOutline,
  CreateOutline,
} from "@vicons/ionicons5";
import { useRoute } from "vue-router";

// API helpers
import { adminTenantResources } from "@/api/resources";
import { tenantOverview } from "@/api/metrics";
import { listAgents } from "@/api/agents";
import { adminEnqueueTask, makeTasksApi } from "@/api/tasks";

import CreateVMButton from "@/components/admin/CreateVMButton.vue";
import EditVMButton from "@/components/admin/EditVMButton.vue";
import ConsoleModal from "@/components/console/ConsoleModal.vue";
import { fmtInt, fmtBytes, pct } from "@/lib/format";

/* ----- constants / reactive state ----- */
const MB = 1024 * 1024;
const route = useRoute();
const tenantId = decodeURIComponent(route.params.tenantId);

const message = useMessage();
const dialog = useDialog();

const loading = ref(true);
const q = ref("");
const ov = ref({
  vms: { total: 0, byState: {} },
  compute: { vcpus: 0, memMB: 0 },
  storage: { usedMB: 0, provisionedMB: 0 },
  tasks: { last24h: { queued: 0, done: 0, error: 0 } },
});
const rows = ref([]); // VM list for this tenant
const checked = ref([]); // selected row keys
const agentOptions = ref([]); // for create VM button

// Serial console modal state
const consoleOpen = ref(false);
const consoleWsUrl = ref(null);
const consoleInfo = ref({ tunnelId: "", expiresAt: "" });
const consoleVm = ref(null);

// Edit VM modal (opened via ref)
const editVm = ref(null);
const editRef = ref(null);

const tasksApi = makeTasksApi("admin");

/* ----- derived values ----- */
const overviewSubtitle = computed(() => {
  const t = ov.value.tasks?.last24h || {};
  return `Tenant overview — 24h tasks: queued ${fmtInt(
    t.queued
  )}, done ${fmtInt(t.done)}, error ${fmtInt(t.error)}`;
});
const storagePct = computed(() => {
  const used = ov.value.storage.usedMB * MB;
  const prov = ov.value.storage.provisionedMB * MB;
  return prov ? (used / prov) * 100 : 0;
});
const filtered = computed(() => {
  const term = (q.value || "").toLowerCase().trim();
  if (!term) return rows.value;
  return rows.value.filter((r) => {
    const name = String(r.name || "").toLowerCase();
    const agent = String(r.agentId || "").toLowerCase();
    const ips = (r.ips || []).join(" ").toLowerCase();
    return name.includes(term) || agent.includes(term) || ips.includes(term);
  });
});

/* ----- table config ----- */
const rowKey = (r) => `${r.agentId}::${r.guid || r.id || r.name}`;
const renderIcon = (icon) => () => h(NIcon, null, { default: () => h(icon) });

function actionsMenu(r) {
  const state = String(r.state || "Unknown");
  const canStart = state !== "Running";
  const canStop =
    state === "Running" || state === "Paused" || state === "Saved";
  return [
    { key: "edit", label: "Edit", icon: renderIcon(CreateOutline) },
    {
      key: "console",
      label: "Serial console",
      icon: renderIcon(TerminalOutline),
    },
    { type: "divider" },
    {
      key: "start",
      label: "Start",
      icon: renderIcon(PowerSharp),
      disabled: !canStart,
    },
    {
      key: "off",
      label: "Shutdown",
      icon: renderIcon(PowerSharp),
      disabled: !canStop,
    },
    {
      key: "restart",
      label: "Restart",
      icon: renderIcon(PowerSharp),
      disabled: !canStop,
    },
    { type: "divider" },
    {
      key: "delete",
      label: "Delete",
      icon: renderIcon(TrashOutline),
      props: { style: "color: var(--n-error-color)" },
    },
  ];
}

function onAction(key, r) {
  if (key === "edit") return openEdit(r);
  if (key === "console") return openConsole(r);
  if (key === "start") return power(r, "start");
  if (key === "off") return power(r, "off");
  if (key === "restart") return power(r, "restart");
  if (key === "delete") return removeVM(r);
}

const cols = [
  {
    title: "Name",
    key: "name",
    ellipsis: true,
    render: (r) =>
      h("div", { class: "vm-name" }, [
        h("strong", r.name || "—"),
        r.display && r.display !== r.name
          ? h("div", { class: "muted" }, r.display)
          : null,
      ]),
  },
  {
    title: "Agent",
    key: "agentId",
    render: (r) => h("code", { style: "font-size:12px" }, r.agentId),
  },
  {
    title: "State",
    key: "state",
    render: (r) => {
      const s = String(r.state || "Unknown");
      const type =
        s === "Running"
          ? "success"
          : s === "Off"
          ? "default"
          : s === "Saved"
          ? "warning"
          : "info";
      return h(
        NTag,
        { size: "small", type, round: true },
        { default: () => s }
      );
    },
  },
  {
    title: "vCPU",
    key: "cpu",
    width: 70,
    render: (r) => fmtInt(r.cpu || r.cpuCount || 0),
  },
  {
    title: "RAM",
    key: "ramMB",
    width: 100,
    render: (r) => (r.ramMB ? `${Math.round(r.ramMB / 1024)} GB` : "—"),
  },
  {
    title: "vSwitch",
    key: "switches",
    render: (r) => {
      const arr = r.switches || [];
      if (!arr.length) return "—";
      return h(
        NSpace,
        { size: 4, wrap: true },
        {
          default: () =>
            arr
              .slice(0, 3)
              .map((sw) =>
                h(NTag, { size: "small", round: true }, { default: () => sw })
              ),
        }
      );
    },
  },
  {
    title: "IP",
    key: "ips",
    width: 170,
    render: (r) => ((r.ips || []).length ? r.ips.join(", ") : "—"),
  },
  {
    title: "Disk",
    key: "disk",
    width: 180,
    render: (r) => {
      const used = Number(r.diskUsedMB || 0) * MB;
      const prov = Number(r.diskProvMB || 0) * MB;
      const per = prov ? pct(used, prov) : 0;
      return h("div", { style: "min-width:160px" }, [
        h(
          "div",
          { style: "font-size:12px;margin-bottom:4px" },
          `${fmtBytes(used)} / ${fmtBytes(prov)}`
        ),
        h(
          "div",
          {
            style:
              "height:8px;background:var(--n-border-color);border-radius:6px;overflow:hidden",
          },
          [h("div", { class: "bar-fill", style: `width:${per}%;height:100%` })]
        ),
      ]);
    },
  },
  {
    title: "",
    key: "actions",
    width: 56,
    align: "right",
    render: (r) =>
      h(
        NDropdown,
        {
          options: actionsMenu(r),
          onSelect: (k) => onAction(k, r),
          placement: "bottom-end",
        },
        {
          default: () =>
            h(
              NButton,
              {
                quaternary: true,
                size: "small",
                circle: true,
                title: "Actions",
              },
              {
                icon: () =>
                  h(NIcon, null, { default: () => h(EllipsisHorizontal) }),
              }
            ),
        }
      ),
  },
];

/* ----- selection handling ----- */
function onSel(keys) {
  checked.value = keys;
}

/* ----- API mapping (GET resources) -----------------------------------------
   The resources endpoint isn't uniform across agents. Normalize here once,
   keep the UI simple elsewhere. */
function normalizeVM(item) {
  const guid = item.guid || item.id || item.refId || null;
  const nics = item.networkAdapters || item.nics || [];
  const ips = Array.isArray(item.ips)
    ? item.ips
    : Array.isArray(nics)
    ? nics.flatMap((n) => n.ips || [])
    : [];
  const switches = Array.isArray(item.switches)
    ? item.switches
    : Array.isArray(nics)
    ? nics.map((n) => n.switch).filter(Boolean)
    : [];
  const disks = item.storage || item.disks || [];
  const provMB = disks.reduce((a, d) => a + Number(d?.vhd?.sizeMB || 0), 0);
  const usedMB = disks.reduce((a, d) => a + Number(d?.vhd?.fileSizeMB || 0), 0);

  return {
    tenantId,
    agentId: item.agentId || item.agent || "",
    guid,
    id: guid,
    name: item.name || "—",
    display: item.displayName || "",
    state: item.state || "Unknown",
    cpu: item.configuration?.cpu?.count ?? item.cpuCount ?? 0,
    ramMB: item.configuration?.memory?.startupMB ?? item.memoryAssignedMB ?? 0,
    switches,
    ips,
    diskProvMB: item.diskProvMB ?? provMB,
    diskUsedMB: item.diskUsedMB ?? usedMB,
    generation: item.generation ?? item.gen ?? null,
    firmware:
      item.firmware ??
      (item.secureBoot !== undefined
        ? { secureBoot: !!item.secureBoot }
        : undefined),
  };
}

/* ----- API loaders ----- */
async function loadOverview() {
  const res = await tenantOverview(tenantId);
  const d = res?.data?.data || res?.data || res;
  if (!d) return;
  ov.value = {
    vms: d.vms || { total: 0, byState: {} },
    compute: d.compute || { vcpus: 0, memMB: 0 },
    storage: d.storage || { usedMB: 0, provisionedMB: 0 },
    tasks: d.tasks || { last24h: { queued: 0, done: 0, error: 0 } },
  };
}

async function loadResources() {
  const res = await adminTenantResources(tenantId);
  const items = res?.data?.items || res?.data?.data || res?.data || [];
  console.log(items);
  rows.value = (Array.isArray(items) ? items : []).map(normalizeVM);
}

async function loadAgents() {
  try {
    const res = await listAgents();
    const items = res?.data?.items ?? res?.data ?? [];
    agentOptions.value = items
      .filter(Boolean)
      .map((a) => ({
        label: a.displayName ?? a.name ?? a.id ?? a.agentId,
        value: a.id ?? a.agentId,
        agentId: a.agentId ?? a.id,
        host: a.host,
      }))
      .sort((x, y) => String(x.label).localeCompare(String(y.label)));
  } catch (e) {
    message.error(
      e?.response?.data?.error || e.message || "Failed to load agents"
    );
    agentOptions.value = [];
  }
}

/* ----- refresh orchestrator ----- */
async function refreshAll() {
  loading.value = true;
  try {
    await Promise.all([loadOverview(), loadResources(), loadAgents()]);
  } catch (e) {
    message.error(
      e?.response?.data?.error || e.message || "Failed to load data"
    );
  } finally {
    loading.value = false;
  }
}

onMounted(refreshAll);

/* ----- task helpers (actions) ----------------------------------------------
   Keep payloads tight. The backend resolves references from target + guid/name. */
function vmTarget(r) {
  return { kind: "vm", agentId: r.agentId, refId: r.guid || r.id || r.name };
}

async function power(r, state) {
  try {
    await adminEnqueueTask({
      tenantId,
      target: vmTarget(r),
      action: "vm.power",
      data: { guid: r.guid || r.id || r.name, state },
    });
    message.success(`Action "${state}" sent to ${r.name}`);
  } catch (e) {
    message.error(e?.response?.data?.error || e.message || "Action failed");
  }
}

function removeVM(r) {
  dialog.warning({
    title: `Delete ${r.name}?`,
    content: "This action is irreversible.",
    positiveText: "Delete",
    negativeText: "Cancel",
    onPositiveClick: async () => {
      try {
        await adminEnqueueTask({
          tenantId,
          target: vmTarget(r),
          action: "vm.delete",
          data: { guid: r.guid, forceStop: true },
        });
        message.success(`Deletion requested for ${r.name}`);
      } catch (e) {
        message.error(
          e?.response?.data?.error || e.message || "Deletion failed"
        );
      }
    },
  });
}

/* ----- serial console flow ----- */
async function openConsole(r) {
  consoleVm.value = r;
  consoleOpen.value = true;
  consoleWsUrl.value = null;

  try {
    const res = await tasksApi.enqueueTask({
      tenantId,
      target: vmTarget(r),
      action: "console.serial.open",
      data: {},
    });

    const c = res?.console || res?._console || res?.data?.console;
    if (!c?.wsUrl) throw new Error("Invalid response (missing wsUrl)");

    consoleInfo.value = {
      tunnelId: c.tunnelId || "",
      expiresAt: c.expiresAt || "",
    };
    consoleWsUrl.value = c.wsUrl;
  } catch (e) {
    consoleOpen.value = false;
    message.error(
      e?.response?.data?.error || e.message || "Failed to open console"
    );
  }
}

function reconnectConsole() {
  if (consoleVm.value) openConsole(consoleVm.value);
}

function onConsoleClosed() {
  consoleWsUrl.value = null;
  consoleVm.value = null;
}

/* ----- edit modal flow ----- */
async function openEdit(r) {
  editVm.value = r;
  await nextTick(); // ensure the modal is mounted
  editRef.value?.open(); // open programmatically – no visible trigger
}
</script>

<style scoped>
/* Layout spacing */
.page {
  display: grid;
  gap: 12px;
}
.block {
  margin-top: 8px;
}

/* Two-column sections that collapse on smaller screens */
.two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 1100px) {
  .two-col {
    grid-template-columns: 1fr 1fr;
  }
}

/* Small helper styles */
.bar-fill {
  background: var(--n-primary-color);
}
.kpi-line {
  display: flex;
  gap: 12px;
  font-size: 12px;
  opacity: 0.9;
}

/* KPI cards: let content grow and pin footer to bottom */
.kpi-grid :deep(.n-card) {
  min-height: var(--kpi-h, 128px);
  display: flex;
  flex-direction: column;
}
.kpi-grid :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kpi-grid :deep(.n-card__footer) {
  margin-top: auto;
}

/* Table niceties */
.metric-big {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
.bar-row :deep(.n-progress) {
  flex: 1;
}
.pct {
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  opacity: 0.9;
}

/* Secondary line under VM name */
.vm-name .muted {
  font-size: 11px;
  opacity: 0.75;
}
</style>
