<template>
  <div class="page">
    <page-toolbar title="Overview">
      <!-- Right-side toolbar actions -->
      <template #actions>
        <n-space :size="6" wrap>
          <n-tag size="small" type="warning" round>
            Queued: {{ fmtInt(overview.tasks.last24h.queued) }}
          </n-tag>
          <n-tag size="small" type="success" round>
            Done: {{ fmtInt(overview.tasks.last24h.done) }}
          </n-tag>
          <n-tag size="small" type="error" round>
            Error: {{ fmtInt(overview.tasks.last24h.error) }}
          </n-tag>
        </n-space>
      </template>
    </page-toolbar>

    <n-spin :show="loading">
      <n-grid
        responsive="screen"
        cols="1 s:2 m:3 l:4 xl:6"
        x-gap="12"
        y-gap="12"
        class="kpi-grid"
        style="--kpi-h: 128px"
      >
        <n-grid-item>
          <stat-card title="Agents (online)">
            {{ fmtInt(overview.agents.online) }}/{{
              fmtInt(overview.agents.total)
            }}
            <template #footer>
              <n-progress
                type="line"
                :percentage="agentsPctOnline"
                :height="8"
                processing
              />
            </template>
          </stat-card>
        </n-grid-item>

        <n-grid-item>
          <stat-card title="Tenants" :value="fmtInt(overview.tenants.total)" />
        </n-grid-item>

        <n-grid-item>
          <stat-card title="VMs (global)" :value="fmtInt(overview.vms.total)">
            <template #footer>
              <div class="kpi-line">
                <span
                  >Running:
                  {{ fmtInt(overview.vms.byState.Running || 0) }}</span
                >
                <span>Off: {{ fmtInt(overview.vms.byState.Off || 0) }}</span>
                <span
                  >Saved: {{ fmtInt(overview.vms.byState.Saved || 0) }}</span
                >
              </div>
            </template>
          </stat-card>
        </n-grid-item>

        <n-grid-item>
          <stat-card
            title="CPU Cores (global)"
            :value="fmtInt(overview.compute.cpuCores)"
          />
        </n-grid-item>

        <n-grid-item>
          <stat-card
            title="RAM (global)"
            :value="
              overview.compute.memMB
                ? Math.round(overview.compute.memMB / 1024) + ' GB'
                : '—'
            "
          />
        </n-grid-item>

        <n-grid-item>
          <stat-card title="Storage (global)">
            {{ fmtBytes(dsUsedBytes) }} /
            {{ fmtBytes(overview.datastores.totalBytes) }}
            <template #footer>
              <n-progress
                type="line"
                :percentage="dsUsedPct"
                :height="8"
                processing
              />
            </template>
          </stat-card>
        </n-grid-item>
      </n-grid>

      <div class="block two-col">
        <n-card title="Compute by agent" size="small" :bordered="true">
          <n-data-table
            :columns="colsCompute"
            :data="tableCompute"
            :bordered="false"
            size="small"
          />
        </n-card>

        <n-card title="Storage by agent" size="small" :bordered="true">
          <n-data-table
            :columns="colsStorage"
            :data="tableStorage"
            :bordered="false"
            size="small"
          />
        </n-card>
      </div>
    </n-spin>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, h } from "vue";
import {
  NGrid,
  NGridItem,
  NCard,
  NProgress,
  NTag,
  NSpace,
  NDataTable,
  NSpin,
} from "naive-ui";
import PageToolbar from "@/components/common/PageToolbar.vue";
import StatCard from "@/components/common/StatCard.vue";
import { adminOverview, adminCompute, adminDatastores } from "@/api/metrics";
import { fmtInt, fmtBytes, pct } from "@/lib/format";

const loading = ref(true);
const overview = ref({
  agents: { total: 0, online: 0, offline: 0 },
  tenants: { total: 0 },
  vms: { total: 0, byState: {} },
  compute: { cpuCores: 0, memMB: 0 },
  datastores: { totalBytes: 0, freeBytes: 0 },
  tasks: { last24h: { queued: 0, done: 0, error: 0 } },
});
const tableCompute = ref([]);
const tableStorage = ref([]);

const agentsPctOnline = computed(() =>
  pct(overview.value.agents.online, overview.value.agents.total)
);
const dsUsedBytes = computed(() =>
  Math.max(
    overview.value.datastores.totalBytes - overview.value.datastores.freeBytes,
    0
  )
);
const dsUsedPct = computed(() =>
  pct(dsUsedBytes.value, overview.value.datastores.totalBytes)
);

// Tables
const colsCompute = [
  { title: "Agent", key: "agentId" },
  { title: "Hostname", key: "hostname" },
  { title: "CPU Cores", key: "cpuCores", render: (r) => fmtInt(r.cpuCores) },
  {
    title: "RAM",
    key: "memMB",
    render: (r) => (r.memMB ? Math.round(r.memMB / 1024) + " GB" : "—"),
  },
  { title: "OS", key: "os" },
];

const colsStorage = [
  { title: "Agent", key: "agentId" },
  { title: "Total", key: "totalBytes", render: (r) => fmtBytes(r.totalBytes) },
  { title: "Free", key: "freeBytes", render: (r) => fmtBytes(r.freeBytes) },
  {
    title: "Usage",
    key: "usage",
    render: (r) => {
      const used = Math.max((r.totalBytes || 0) - (r.freeBytes || 0), 0);
      const per = pct(used, r.totalBytes);
      return h(
        "div",
        { style: "min-width:160px" },
        h(
          "div",
          { style: "font-size:12px; margin-bottom:4px" },
          `${fmtBytes(used)} / ${fmtBytes(r.totalBytes)}`
        ),
        h("div", {}, [
          h(
            "div",
            {
              style:
                "height:8px;background:var(--n-border-color);border-radius:6px;overflow:hidden",
            },
            [
              h("div", {
                style: `width:${per}%;height:100%`,
                class: "bar-fill",
              }),
            ]
          ),
        ])
      );
    },
  },
];

onMounted(async () => {
  loading.value = true;
  try {
    const [o, c, d] = await Promise.all([
      adminOverview(),
      adminCompute(),
      adminDatastores(),
    ]);
    overview.value = o.data || overview.value;
    tableCompute.value = c.data?.byAgent || [];
    tableStorage.value = d.data?.byAgent || [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page {
  display: grid;
  gap: 12px;
}
.block {
  margin-top: 8px;
}
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
.bar-fill {
  background: var(--n-primary-color);
}
.kpi-line {
  display: flex;
  gap: 12px;
  font-size: 12px;
  opacity: 0.9;
}

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
.kpi-grid :deep(.n-grid-item),
.kpi-grid :deep(.n-card),
.kpi-grid :deep(.n-card__content),
.kpi-grid :deep(.n-card__footer) {
  overflow: visible;
}
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

/* Mobile/tablet: allow cards to grow */
@media (max-width: 960px) {
  .kpi-grid :deep(.n-card) {
    min-height: 0;
    height: auto;
  }
  .kpi-grid :deep(.n-card__content) {
    justify-content: flex-start;
  }
}
</style>
