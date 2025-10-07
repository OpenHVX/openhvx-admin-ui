<!-- src/views/admin/UnassignedResources.vue -->
<script setup>
/* --------------------------------------------------------------------------
   Unassigned Resources
   - List items discovered by agents but not yet linked to a tenant.
   - You can filter by agent, search locally, assign to a tenant, or delete.
   - Tabs switch between VMs / VHDs / vSwitches. Selection works across pages.
---------------------------------------------------------------------------*/

import { ref, computed, watch, h } from "vue";
import {
  NPageHeader,
  NCard,
  NInput,
  NButton,
  NIcon,
  NDataTable,
  NFlex,
  NTag,
  NPagination,
  NDivider,
  NTooltip,
  NModal,
  NSelect,
  NEmpty,
  NTabs,
  NTabPane,
  useNotification,
  useDialog,
} from "naive-ui";
import {
  SearchOutline,
  RefreshOutline,
  TrashOutline,
  LinkOutline,
} from "@vicons/ionicons5";

// API (JS)
import {
  listUnassigned,
  adminClaimResources,
  adminUnassignedBulkDelete,
} from "@/api/resources";

/* ===== UI helpers ===== */
const notify = useNotification();
const dialog = useDialog();

/* Bytes math */
const MB = 1024 * 1024;

/* Human-readable bytes */
const formatBytes = (v) => {
  if (v == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = Number(v);
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
};

/* ===== State / filters ===== */
const activeType = ref("vm"); // "vm" | "vhd" | "switch"
const q = ref(""); // local search
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);

/* Data: normalized rows for the current tab */
const rows = ref([]); // array of normalized items for activeType

/* Selection: stores refIds */
const selection = ref([]);

/* Optional agent filter combo */
const agentId = ref(null);
const agentOptions = ref([]);

/* Assign modal state */
const assignModal = ref(false);
const assignTenantId = ref(null);
const tenants = ref([]);
const assigning = ref(false);

/* Convenience */
const hasSelection = computed(() => selection.value.length > 0);

/* ===== Normalizers (backend payloads aren't uniform — normalize once) ===== */
function normalizeVm(item) {
  const raw = item.raw || {};
  const cpu = raw?.configuration?.cpu?.count ?? null;
  const memMB =
    raw?.configuration?.memory?.startupMB ?? raw?.memoryAssignedMB ?? null;
  const diskBytes = Array.isArray(raw?.storage)
    ? raw.storage.reduce((a, s) => {
        const mb = Number(s?.vhd?.fileSizeMB ?? s?.vhd?.sizeMB ?? 0);
        return a + mb * MB;
      }, 0)
    : null;

  return {
    kind: "vm",
    refId: item.refId || item.id,
    host: item.agentId,
    name: item.name || "—",
    state: item.state || "Unknown",
    vcpus: cpu,
    memoryMB: memMB,
    diskBytes,
    ts: item.ts || null,
    _agentId: item.agentId,
  };
}

function normalizeVhd(item) {
  const raw = item.raw || {};
  const sizeMB = Number(
    raw?.vhd?.fileSizeMB ?? raw?.vhd?.sizeMB ?? raw?.sizeMB ?? 0
  );
  return {
    kind: "vhd",
    refId: item.refId || item.id || raw?.path || item.name,
    host: item.agentId,
    path: raw?.path || item.name || "—",
    size: sizeMB * MB,
    vhdType: raw?.vhd?.type || raw?.type || "—",
    parentPath: raw?.vhd?.parentPath || "",
    ts: item.ts || null,
    _agentId: item.agentId,
  };
}

function normalizeSwitch(item) {
  const raw = item.raw || {};
  return {
    kind: "switch",
    refId: item.refId || item.id || item.name,
    host: item.agentId,
    name: item.name || raw?.name || "—",
    swType: raw?.type || "—",
    uplinks: Array.isArray(raw?.uplinks) ? raw.uplinks : [],
    ts: item.ts || null,
    _agentId: item.agentId,
  };
}

function normalizeByKind(item) {
  const k = String(item.kind || "").toLowerCase();
  if (k === "vm") return normalizeVm(item);
  if (k === "vhd") return normalizeVhd(item);
  if (k === "switch") return normalizeSwitch(item);
  return null;
}

/* ===== Data loaders ===== */
async function fetchTenants() {
  try {
    const r = await fetch("/api/tenants?projection=basic", {
      credentials: "include",
    });
    if (!r.ok) throw new Error(`GET /api/tenants -> ${r.status}`);
    const data = await r.json();
    tenants.value = (data?.data || data || []).map((t) => ({
      label: t.name || t.tenantId,
      value: t.tenantId,
    }));
  } catch (e) {
    console.error(e);
    notify.error({ title: "Tenants", content: "Failed to load tenants list." });
  }
}

/* Fetch and normalize items for the current tab/agent filter.
   Note: search + pagination are local to avoid chatty network calls. */
const fetchData = async () => {
  loading.value = true;
  try {
    const res = await listUnassigned({
      kind: activeType.value,
      agentId: agentId.value || undefined,
    });

    const payload = res?.data?.data ?? res?.data ?? res;
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];

    // Build agent filter options from response
    agentOptions.value = Array.from(
      new Set(items.map((x) => x.agentId).filter(Boolean))
    )
      .sort()
      .map((a) => ({ label: a, value: a }));

    // Normalize and keep only the active kind
    const normalized = items.map(normalizeByKind).filter(Boolean);
    rows.value = normalized.filter((r) => r.kind === activeType.value);

    // Reset selection when dataset changes
    selection.value = [];
  } catch (e) {
    console.error(e);
    notify.error({
      title: "Loading",
      content: `Failed to load resources (${e.message}).`,
    });
  } finally {
    loading.value = false;
  }
};

/* Refetch when switching tab or agent filter */
watch(
  [activeType, agentId],
  () => {
    page.value = 1;
    fetchData();
  },
  { immediate: true }
);

/* On search, just reset to first page (filtering is local) */
watch(q, () => {
  page.value = 1;
});

/* ===== Assign / Delete (bulk) ===== */
const openAssignModal = async () => {
  await fetchTenants();
  assignTenantId.value = null;
  assignModal.value = true;
};

const doAssign = async () => {
  if (!assignTenantId.value) {
    notify.warning({ title: "Assign", content: "Select a tenant." });
    return;
  }
  if (!selection.value.length) {
    notify.warning({ title: "Assign", content: "No resource selected." });
    return;
  }
  assigning.value = true;
  try {
    await adminClaimResources(assignTenantId.value, {
      kind: activeType.value,
      ids: selection.value, // refIds
    });
    notify.success({
      title: "Assignment complete",
      content: `${selection.value.length} resource(s) assigned.`,
    });
    assignModal.value = false;
    selection.value = [];
    fetchData();
  } catch (e) {
    console.error(e);
    notify.error({ title: "Assign", content: `Failed: ${e.message}` });
  } finally {
    assigning.value = false;
  }
};

const doDelete = () => {
  if (!selection.value.length) return;
  dialog.warning({
    title: "Delete these resources?",
    content:
      `${selection.value.length} item(s) will be removed from the inventory. ` +
      `(No VM will be powered off on Hyper-V.)`,
    positiveText: "Delete",
    negativeText: "Cancel",
    onPositiveClick: async () => {
      try {
        await adminUnassignedBulkDelete({
          kind: activeType.value,
          ids: selection.value,
        });
        notify.success({
          title: "Deleted",
          content: `${selection.value.length} item(s).`,
        });
        selection.value = [];
        fetchData();
      } catch (e) {
        notify.error({ title: "Delete", content: `Failed: ${e.message}` });
      }
    },
  });
};

/* ===== Table config (no JSX) ===== */
const rowKey = (row) => row.refId || row._id || row.id || row.name;

/* Per-row quick actions (assign / delete) */
function actionButtons(row) {
  return h(
    "div",
    { style: "display:flex; gap:6px; justify-content:flex-end" },
    [
      h(
        NTooltip,
        { trigger: "hover" },
        {
          trigger: () =>
            h(
              NButton,
              {
                size: "small",
                quaternary: true,
                onClick: () => {
                  selection.value = [rowKey(row)];
                  openAssignModal();
                },
                "aria-label": "Assign to tenant",
              },
              {
                default: () =>
                  h(NIcon, null, { default: () => h(LinkOutline) }),
              }
            ),
          default: () => "Assign",
        }
      ),
      h(
        NTooltip,
        { trigger: "hover" },
        {
          trigger: () =>
            h(
              NButton,
              {
                size: "small",
                quaternary: true,
                type: "error",
                onClick: () => {
                  selection.value = [rowKey(row)];
                  doDelete();
                },
                "aria-label": "Delete",
              },
              {
                default: () =>
                  h(NIcon, null, { default: () => h(TrashOutline) }),
              }
            ),
          default: () => "Delete",
        }
      ),
    ]
  );
}

/* Columns vary by active tab */
const columnsByType = computed(() => {
  if (activeType.value === "vm") {
    return [
      { title: "Host", key: "host", width: 200, ellipsis: true },
      { title: "Name", key: "name", minWidth: 220, ellipsis: true },
      {
        title: "State",
        key: "state",
        width: 100,
        render(row) {
          if (!row.state) return "—";
          const type =
            row.state === "Running"
              ? "success"
              : row.state === "Off"
              ? "default"
              : "warning";
          return h(
            NTag,
            { size: "small", type, round: true },
            { default: () => row.state }
          );
        },
      },
      { title: "vCPU", key: "vcpus", width: 70, align: "right" },
      {
        title: "RAM",
        key: "memoryMB",
        width: 90,
        align: "right",
        render: (r) =>
          r.memoryMB ? `${Math.round(r.memoryMB / 1024)} GB` : "—",
      },
      {
        title: "Total disk",
        key: "diskBytes",
        width: 120,
        align: "right",
        render: (r) => formatBytes(r.diskBytes),
      },
      {
        title: "Discovered",
        key: "ts",
        width: 160,
        render: (r) => (r.ts ? new Date(r.ts).toLocaleString() : "—"),
      },
      {
        title: "",
        key: "actions",
        width: 120,
        align: "right",
        render: (row) => actionButtons(row),
      },
    ];
  }
  if (activeType.value === "vhd") {
    return [
      { title: "Host", key: "host", width: 200, ellipsis: true },
      { title: "Path", key: "path", minWidth: 320, ellipsis: true },
      { title: "Type", key: "vhdType", width: 120, ellipsis: true },
      {
        title: "Size",
        key: "size",
        width: 120,
        align: "right",
        render: (r) => formatBytes(r.size),
      },
      {
        title: "Parent",
        key: "parentPath",
        minWidth: 280,
        ellipsis: true,
        render: (r) => r.parentPath || "—",
      },
      {
        title: "Discovered",
        key: "ts",
        width: 160,
        render: (r) => (r.ts ? new Date(r.ts).toLocaleString() : "—"),
      },
      {
        title: "",
        key: "actions",
        width: 120,
        align: "right",
        render: (row) => actionButtons(row),
      },
    ];
  }
  // switches
  return [
    { title: "Host", key: "host", width: 200, ellipsis: true },
    { title: "Name", key: "name", minWidth: 220, ellipsis: true },
    { title: "Type", key: "swType", width: 110, ellipsis: true },
    {
      title: "Uplinks",
      key: "uplinks",
      minWidth: 160,
      ellipsis: true,
      render: (r) => (r.uplinks?.length ? r.uplinks.join(", ") : "—"),
    },
    {
      title: "Discovered",
      key: "ts",
      width: 160,
      render: (r) => (r.ts ? new Date(r.ts).toLocaleString() : "—"),
    },
    {
      title: "",
      key: "actions",
      width: 120,
      align: "right",
      render: (row) => actionButtons(row),
    },
  ];
});

/* DataTable columns, with selection checkbox on the left */
const tableColumns = computed(() => [
  { type: "selection", multiple: true, fixed: "left" },
  ...columnsByType.value,
]);

/* Keep selected keys in sync with the table */
const onUpdateCheckedRowKeys = (keys) => {
  selection.value = keys; // keys = refId
};

/* Local filtering + paging (no network) */
const filteredRows = computed(() => {
  const term = q.value.trim().toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(term)
  );
});
const total = computed(() => filteredRows.value.length);
const displayedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

/* Manual refresh button */
const refresh = () => fetchData();
</script>

<template>
  <div class="page">
    <!-- ===== Header ===== -->
    <NPageHeader
      class="mb-2"
      title="Unassigned resources"
      subtitle="Discovered by agents but not linked to any tenant yet."
    >
      <template #extra>
        <NFlex :size="8" align="center">
          <NInput
            v-model:value="q"
            placeholder="Search (name, host, path…)"
            clearable
            style="min-width: 320px"
          >
            <template #prefix>
              <NIcon><SearchOutline /></NIcon>
            </template>
          </NInput>

          <NSelect
            v-model:value="agentId"
            :options="agentOptions"
            clearable
            placeholder="Filter by agent (host)"
            style="min-width: 260px"
          />

          <NButton quaternary @click="refresh" aria-label="Refresh">
            <template #icon>
              <NIcon><RefreshOutline /></NIcon>
            </template>
            Refresh
          </NButton>

          <NDivider vertical />

          <NButton
            :disabled="!hasSelection"
            type="primary"
            tertiary
            @click="openAssignModal"
          >
            <template #icon>
              <NIcon><LinkOutline /></NIcon>
            </template>
            Assign to tenant
          </NButton>

          <NButton
            :disabled="!hasSelection"
            type="error"
            tertiary
            @click="doDelete"
          >
            <template #icon>
              <NIcon><TrashOutline /></NIcon>
            </template>
            Delete
          </NButton>
        </NFlex>
      </template>
    </NPageHeader>

    <!-- ===== Body ===== -->
    <NCard :bordered="false">
      <!-- Tabs (VMs / VHDs / Switches) -->
      <NTabs v-model:value="activeType" type="line" animated class="card-tabs">
        <NTabPane name="vm" tab="VMs" />
        <NTabPane name="vhd" tab="VHDs" />
        <NTabPane name="switch" tab="Switches" />
      </NTabs>

      <!-- Data table -->
      <NDataTable
        :loading="loading"
        :columns="tableColumns"
        :data="displayedRows"
        :row-key="rowKey"
        :scroll-x="980"
        :pagination="false"
        :max-height="560"
        @update:checked-row-keys="onUpdateCheckedRowKeys"
        v-if="displayedRows.length || loading"
      />
      <NEmpty description="No unassigned resources" v-else class="py-12" />

      <!-- Table footer: pager + count -->
      <template #action>
        <div class="table-actions">
          <div class="muted">{{ total }} item(s)</div>
          <NPagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :item-count="total"
            :page-sizes="[10, 20, 50, 100]"
            show-size-picker
          />
        </div>
      </template>
    </NCard>

    <!-- ===== Assign modal ===== -->
    <NModal v-model:show="assignModal" preset="dialog" title="Assign to tenant">
      <div class="assign">
        <div class="mb-2">{{ selection.length }} resource(s) selected</div>
        <NSelect
          v-model:value="assignTenantId"
          :options="tenants"
          filterable
          clearable
          placeholder="Choose a tenant"
        />
        <div
          class="mt-3"
          style="display: flex; gap: 8px; justify-content: flex-end"
        >
          <NButton quaternary @click="assignModal = false">Cancel</NButton>
          <NButton type="primary" :loading="assigning" @click="doAssign">
            Assign
          </NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.page {
  padding: 6px;
}
.mb-2 {
  margin-bottom: 0.5rem;
}
.py-12 {
  padding: 3rem 0;
}
.mt-3 {
  margin-top: 0.75rem;
}

.card-tabs :deep(.n-tabs-nav--bar-type) {
  padding-left: 4px;
}

.table-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
}
.muted {
  opacity: 0.7;
  font-size: 12px;
}

.assign {
  min-width: 420px;
}
@media (max-width: 520px) {
  .assign {
    min-width: 0;
    width: 100%;
  }
}
</style>
