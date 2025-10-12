<!-- src/views/admin/Tenants.vue -->
<template>
  <div class="page">
    <!-- ===== Toolbar ===== -->
    <page-toolbar
      title="Tenants"
      subtitle="Manage tenant spaces"
      :show-divider="true"
    >
      <template #actions>
        <n-space :size="8" wrap>
          <n-input
            v-model:value="q"
            size="small"
            placeholder="Search (id, name)…"
            clearable
            style="max-width: 260px"
          >
            <template #prefix
              ><n-icon><SearchOutline /></n-icon
            ></template>
          </n-input>

          <n-button
            size="small"
            quaternary
            :loading="loading"
            @click="fetchRows"
            title="Refresh"
          >
            <template #icon
              ><n-icon><RefreshOutline /></n-icon
            ></template>
            Refresh
          </n-button>

          <n-button size="small" type="primary" @click="openCreate">
            <template #icon
              ><n-icon><AddOutline /></n-icon
            ></template>
            New tenant
          </n-button>
        </n-space>
      </template>
    </page-toolbar>

    <!-- ===== Table ===== -->
    <n-card :bordered="true" size="small">
      <n-data-table
        :loading="loading"
        :columns="cols"
        :data="filteredRows"
        :bordered="false"
        size="small"
        :row-key="rowKey"
        :row-props="rowProps"
      />
    </n-card>

    <!-- ===== Drawer: Create / Edit tenant (core metadata + initial quotas) ===== -->
    <n-drawer v-model:show="drawer.show" :width="480" placement="right">
      <n-drawer-content
        :title="drawer.mode === 'create' ? 'New tenant' : 'Edit tenant'"
      >
        <n-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-placement="top"
          size="small"
        >
          <n-form-item label="Tenant ID" path="tenantId">
            <n-input
              v-model:value="form.tenantId"
              :disabled="drawer.mode === 'edit'"
            />
          </n-form-item>

          <n-form-item label="Display name" path="name">
            <n-input v-model:value="form.name" placeholder="e.g. Acme Corp" />
          </n-form-item>

          <n-form-item label="Description" path="description">
            <n-input
              type="textarea"
              v-model:value="form.description"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </n-form-item>

          <n-divider>Initial quotas (optional)</n-divider>
          <n-grid :cols="2" :x-gap="12" :y-gap="8">
            <n-gi>
              <n-form-item label="vCPU limit" path="quotas.cpu">
                <n-input-number
                  v-model:value="form.quotas.cpu"
                  :min="-1"
                  placeholder="e.g. 16"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="VM count limit" path="quotas.vmCount">
                <n-input-number
                  v-model:value="form.quotas.vmCount"
                  :min="-1"
                  placeholder="e.g. 10"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>

            <n-gi>
              <n-form-item label="Memory limit (GB)" path="quotas.memoryGB">
                <n-input-number
                  v-model:value="form.memoryGB"
                  :min="-1"
                  placeholder="e.g. 32"
                  :show-button="false"
                />
              </n-form-item>
              <n-text depth="3" style="font-size: 12px"
                >Stored in MB (we'll convert)</n-text
              >
            </n-gi>
            <n-gi>
              <n-form-item label="Storage limit (GB)" path="quotas.storageGB">
                <n-input-number
                  v-model:value="form.storageGB"
                  :min="-1"
                  placeholder="e.g. 500"
                  :show-button="false"
                />
              </n-form-item>
              <n-text depth="3" style="font-size: 12px"
                >Stored in MB (we'll convert)</n-text
              >
            </n-gi>

            <n-gi :span="2">
              <n-form-item label="Networks limit" path="quotas.networkCount">
                <n-input-number
                  v-model:value="form.quotas.networkCount"
                  :min="-1"
                  placeholder="e.g. 5"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>
          </n-grid>
          <n-text depth="3" style="font-size: 12px"
            >Use <code>-1</code> for unlimited.</n-text
          >
        </n-form>

        <template #footer>
          <n-space justify="end">
            <n-button quaternary @click="drawer.show = false">Cancel</n-button>
            <n-button type="primary" :loading="saving" @click="onSubmit">
              {{ drawer.mode === "create" ? "Create" : "Save changes" }}
            </n-button>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>

    <!-- ===== Drawer: Manage quotas (per-tenant) ===== -->
    <n-drawer v-model:show="qDrawer.show" :width="520" placement="right">
      <n-drawer-content :title="`Quotas — ${qDrawer.tenantId}`">
        <n-alert
          v-if="qDrawer.error"
          type="error"
          :bordered="false"
          style="margin-bottom: 8px"
        >
          {{ qDrawer.error }}
        </n-alert>

        <n-skeleton v-if="qDrawer.loading" text :repeat="6" />

        <template v-else>
          <n-descriptions
            bordered
            size="small"
            label-placement="top"
            :column="2"
            style="margin-bottom: 12px"
          >
            <n-descriptions-item label="vCPU">
              <quota-meter
                :used="qState.cpu.used"
                :limit="qState.cpu.limit"
                unit="vCPU"
              />
            </n-descriptions-item>
            <n-descriptions-item label="VMs">
              <quota-meter
                :used="qState.vmCount.used"
                :limit="qState.vmCount.limit"
                unit="VM"
              />
            </n-descriptions-item>
            <n-descriptions-item label="Memory">
              <quota-meter
                :used="qState.memoryMB.used"
                :limit="qState.memoryMB.limit"
                unit="MB"
                :format="fmtMBorGB"
              />
            </n-descriptions-item>
            <n-descriptions-item label="Storage">
              <quota-meter
                :used="qState.storageMB.used"
                :limit="qState.storageMB.limit"
                unit="MB"
                :format="fmtMBorGB"
              />
            </n-descriptions-item>
            <n-descriptions-item label="Networks">
              <quota-meter
                :used="qState.networkCount.used"
                :limit="qState.networkCount.limit"
                unit="net"
              />
            </n-descriptions-item>
          </n-descriptions>

          <n-divider>Update limits</n-divider>
          <n-grid :cols="2" :x-gap="12" :y-gap="8">
            <n-gi>
              <n-form-item label="vCPU limit">
                <n-input-number
                  v-model:value="qForm.cpu"
                  :min="-1"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="VM count limit">
                <n-input-number
                  v-model:value="qForm.vmCount"
                  :min="-1"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="Memory limit (GB)">
                <n-input-number
                  v-model:value="qForm.memoryGB"
                  :min="-1"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>
            <n-gi>
              <n-form-item label="Storage limit (GB)">
                <n-input-number
                  v-model:value="qForm.storageGB"
                  :min="-1"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>
            <n-gi :span="2">
              <n-form-item label="Networks limit">
                <n-input-number
                  v-model:value="qForm.networkCount"
                  :min="-1"
                  :show-button="false"
                />
              </n-form-item>
            </n-gi>
          </n-grid>
          <n-text depth="3" style="font-size: 12px"
            >Use <code>-1</code> for unlimited. GB inputs will be converted to
            MB.</n-text
          >

          <n-space justify="end" style="margin-top: 12px">
            <n-button
              :loading="qDrawer.saving"
              type="primary"
              @click="saveQuotaLimits"
              >Save limits</n-button
            >
          </n-space>
        </template>

        <template #footer>
          <n-space justify="end">
            <n-button quaternary @click="qDrawer.show = false">Close</n-button>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import {
  NCard,
  NDataTable,
  NButton,
  NSpace,
  NInput,
  NIcon,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NDropdown,
  NGrid,
  NGi,
  NDivider,
  useMessage,
  useDialog,
  NInputNumber,
  NText,
  NAlert,
  NDescriptions,
  NDescriptionsItem,
  NSkeleton,
} from "naive-ui";
import {
  SearchOutline,
  RefreshOutline,
  AddOutline,
  TrashOutline,
  OpenOutline,
  CreateOutline,
  EllipsisHorizontal,
} from "@vicons/ionicons5";
import { h, onMounted, ref, computed, defineComponent } from "vue";
import PageToolbar from "@/components/common/PageToolbar.vue";
import { useRouter } from "vue-router";
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantQuotas,
  patchTenantQuotaLimits,
} from "@/api/tenants";

/* ----- tiny quota meter component ----- */
const QuotaMeter = defineComponent({
  name: "quota-meter",
  props: { used: Number, limit: Number, unit: String, format: Function },
  setup(props) {
    const pct = computed(() => {
      if (props.limit === -1) return 0;
      if (!props.limit) return 1;
      return Math.min(1, (props.used || 0) / props.limit);
    });
    const label = computed(() => {
      const f = props.format || ((v) => `${v} ${props.unit || ""}`.trim());
      if (props.limit === -1) return `${f(props.used || 0)} / ∞`;
      return `${f(props.used || 0)} / ${f(props.limit || 0)}`;
    });
    const barStyle = computed(() => {
      const p = Math.round(pct.value * 100);
      let bg = "var(--n-success-color)";
      if (p >= 95) bg = "var(--n-error-color)";
      else if (p >= 80) bg = "var(--n-warning-color)";
      return {
        width: `${props.limit === -1 ? 0 : p}%`,
        background: bg,
        height: "6px",
        borderRadius: "4px",
      };
    });
    return () =>
      h("div", { style: "display:flex; flex-direction:column; gap:6px;" }, [
        h(
          "div",
          {
            style:
              "background: var(--n-divider-color); height:6px; border-radius:4px; overflow:hidden;",
          },
          [h("div", { style: barStyle.value })]
        ),
        h(
          "div",
          { style: "font-size:12px; color: var(--n-text-color-3)" },
          label.value
        ),
      ]);
  },
});
/* register locally */
const quotaMeter = QuotaMeter;

const router = useRouter();
const message = useMessage();
const dialog = useDialog();

/* ----- state ----- */
const loading = ref(true);
const rows = ref([]);
const q = ref("");

const drawer = ref({ show: false, mode: "create", editingId: null });
const formRef = ref(null);
const form = ref({
  tenantId: "",
  name: "",
  description: "",
  quotas: { cpu: null, vmCount: null, networkCount: null },
  memoryGB: null, // convenience inputs
  storageGB: null,
});
const saving = ref(false);

/* Quotas drawer */
const qDrawer = ref({
  show: false,
  tenantId: "",
  loading: false,
  saving: false,
  error: "",
});
const qState = ref({
  cpu: {},
  memoryMB: {},
  storageMB: {},
  vmCount: {},
  networkCount: {},
}); // server state
const qForm = ref({
  cpu: null,
  vmCount: null,
  networkCount: null,
  memoryGB: null,
  storageGB: null,
});

/* ----- rules ----- */
const rules = {
  tenantId: [
    {
      required: true,
      message: "Tenant ID is required",
      trigger: ["input", "blur"],
    },
    {
      validator: (_, v) => /^[a-zA-Z0-9-_:.]+$/.test(v || ""),
      message: "Allowed: a-z A-Z 0-9 - _ : .",
      trigger: ["input", "blur"],
    },
  ],
  name: [
    { required: true, message: "Name is required", trigger: ["input", "blur"] },
  ],
};

/* helpers */
const renderIcon = (icon) => () => h(NIcon, null, { default: () => h(icon) });

function makeRowMenu(row) {
  return [
    { key: "open", label: "View resources", icon: renderIcon(OpenOutline) },
    { key: "edit", label: "Edit", icon: renderIcon(CreateOutline) },
    { key: "quota", label: "Manage quotas", icon: renderIcon(CreateOutline) },
    { type: "divider" },
    {
      key: "del",
      label: "Delete",
      icon: renderIcon(TrashOutline),
      props: { style: "color: var(--n-error-color);" },
    },
  ];
}
function onRowMenuSelect(key, row) {
  if (key === "open") return goResources(row);
  if (key === "edit") return openEdit(row);
  if (key === "quota") return openQuotaDrawer(row);
  if (key === "del") return confirmDelete(row);
}

const rowProps = (row) => ({
  style: "cursor:pointer",
  onClick: (e) => {
    if (
      (e.target.closest && e.target.closest(".n-button")) ||
      (e.target.closest && e.target.closest(".n-dropdown"))
    )
      return;
    goResources(row);
  },
});
function rowKey(r) {
  return r.tenantId || r.id;
}

const filteredRows = computed(() => {
  const term = (q.value || "").toLowerCase().trim();
  if (!term) return rows.value;
  return rows.value.filter((r) => {
    const id = String(r.tenantId || r.id || "").toLowerCase();
    const name = String(r.name || r.displayName || "").toLowerCase();
    return id.includes(term) || name.includes(term);
  });
});

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}
function fmtMBorGB(v) {
  if (v === -1) return "∞";
  if (v == null) return "0";
  const gb = v / 1024;
  return gb >= 1 ? `${Math.round(gb)} GB` : `${v} MB`;
}

/* columns */
const cols = [
  {
    title: "Tenant",
    key: "tenantId",
    render: (r) =>
      h(
        NButton,
        {
          text: true,
          size: "small",
          type: "primary",
          onClick: () => goResources(r),
        },
        {
          default: () => [
            h(NIcon, null, { default: () => h(OpenOutline) }),
            " ",
            r.tenantId || r.id || "—",
          ],
        }
      ),
  },
  {
    title: "Name",
    key: "name",
    render: (r) =>
      h("code", { style: "font-size:12px" }, r.name || r.displayName),
  },
  {
    title: "Created at",
    key: "createdAt",
    render: (r) => fmtDate(r.createdAt),
  },
  {
    title: "",
    key: "actions",
    width: 80,
    align: "right",
    render: (r) =>
      h(
        NDropdown,
        {
          options: makeRowMenu(r),
          onSelect: (key) => onRowMenuSelect(key, r),
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

/* data */
async function fetchRows() {
  loading.value = true;
  try {
    const raw = await listTenants();
    const data = raw?.data?.data;
    rows.value = Array.isArray(data) ? data : data?.items || [];
  } catch (e) {
    message.error(
      e?.response?.data?.error || e.message || "Failed to load tenants"
    );
  } finally {
    loading.value = false;
  }
}

/* create/edit */
function openCreate() {
  drawer.value = { show: true, mode: "create", editingId: null };
  form.value = {
    tenantId: "",
    name: "",
    description: "",
    quotas: { cpu: null, vmCount: null, networkCount: null },
    memoryGB: null,
    storageGB: null,
  };
}
function openEdit(r) {
  drawer.value = { show: true, mode: "edit", editingId: r.tenantId || r.id };
  form.value = {
    tenantId: r.tenantId || r.id,
    name: r.name || r.displayName || "",
    description: r.description || "",
    quotas: { cpu: null, vmCount: null, networkCount: null },
    memoryGB: null,
    storageGB: null,
  };
}

function toLimitsFromForm(f) {
  // build flat limits from drawer form (skip null/undefined)
  const limits = {};
  const add = (k, v) => {
    if (v === 0 || v === -1 || !!v) limits[k] = Number(v);
  };
  add("cpu", f.quotas.cpu);
  add("vmCount", f.quotas.vmCount);
  add("networkCount", f.quotas.networkCount);
  if (f.memoryGB === -1) limits.memoryMB = -1;
  else if (f.memoryGB || f.memoryGB === 0)
    limits.memoryMB = Math.max(0, Math.round(f.memoryGB * 1024));
  if (f.storageGB === -1) limits.storageMB = -1;
  else if (f.storageGB || f.storageGB === 0)
    limits.storageMB = Math.max(0, Math.round(f.storageGB * 1024));
  return limits;
}

async function onSubmit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (drawer.value.mode === "create") {
      const payload = {
        tenantId: form.value.tenantId,
        name: form.value.name,
        description: form.value.description,
      };
      const limits = toLimitsFromForm(form.value);
      if (Object.keys(limits).length) payload.quotas = limits;
      await createTenant(payload);
      message.success("Tenant created");
    } else {
      const payload = {
        name: form.value.name,
        description: form.value.description,
      };
      const limits = toLimitsFromForm(form.value);
      if (Object.keys(limits).length) payload.quotas = limits;
      await updateTenant(drawer.value.editingId, payload);
      message.success("Tenant updated");
    }
    drawer.value.show = false;
    fetchRows();
  } catch (e) {
    message.error(
      e?.response?.data?.message ||
        e?.response?.data?.error ||
        e.message ||
        "Operation failed"
    );
  } finally {
    saving.value = false;
  }
}

/* delete */
function confirmDelete(r) {
  const id = r.tenantId || r.id;
  dialog.warning({
    title: "Delete tenant?",
    content: `This action is irreversible. ID: ${id}`,
    positiveText: "Delete",
    negativeText: "Cancel",
    onPositiveClick: async () => {
      try {
        await deleteTenant(id);
        message.success("Tenant deleted");
        fetchRows();
      } catch (e) {
        message.error(
          e?.response?.data?.message ||
            e?.response?.data?.error ||
            e.message ||
            "Deletion failed"
        );
      }
    },
  });
}

/* quotas drawer */
function openQuotaDrawer(r) {
  qDrawer.value = {
    show: true,
    tenantId: r.tenantId || r.id,
    loading: true,
    saving: false,
    error: "",
  };
  qState.value = {
    cpu: {},
    memoryMB: {},
    storageMB: {},
    vmCount: {},
    networkCount: {},
  };
  qForm.value = {
    cpu: null,
    vmCount: null,
    networkCount: null,
    memoryGB: null,
    storageGB: null,
  };

  getTenantQuotas(qDrawer.value.tenantId)
    .then((resp) => {
      const data = resp?.data?.data || {};
      qState.value = data;

      // Pre-fill form with current limits (convert MB -> GB where relevant)
      qForm.value.cpu = data?.cpu?.limit ?? null;
      qForm.value.vmCount = data?.vmCount?.limit ?? null;
      qForm.value.networkCount = data?.networkCount?.limit ?? null;

      const memLimit = data?.memoryMB?.limit;
      qForm.value.memoryGB =
        memLimit === -1
          ? -1
          : Number.isFinite(memLimit)
          ? Math.round(memLimit / 1024)
          : null;

      const storLimit = data?.storageMB?.limit;
      qForm.value.storageGB =
        storLimit === -1
          ? -1
          : Number.isFinite(storLimit)
          ? Math.round(storLimit / 1024)
          : null;
    })
    .catch((e) => {
      qDrawer.value.error =
        e?.response?.data?.message || e.message || "Failed to load quotas";
    })
    .finally(() => {
      qDrawer.value.loading = false;
    });
}

async function saveQuotaLimits() {
  qDrawer.value.saving = true;
  try {
    const limits = {};
    const add = (k, v) => {
      if (v === 0 || v === -1 || !!v) limits[k] = Number(v);
    };
    add("cpu", qForm.value.cpu);
    add("vmCount", qForm.value.vmCount);
    add("networkCount", qForm.value.networkCount);
    // GB -> MB
    if (qForm.value.memoryGB === -1) limits.memoryMB = -1;
    else if (qForm.value.memoryGB || qForm.value.memoryGB === 0)
      limits.memoryMB = Math.max(0, Math.round(qForm.value.memoryGB * 1024));
    if (qForm.value.storageGB === -1) limits.storageMB = -1;
    else if (qForm.value.storageGB || qForm.value.storageGB === 0)
      limits.storageMB = Math.max(0, Math.round(qForm.value.storageGB * 1024));

    await patchTenantQuotaLimits(qDrawer.value.tenantId, limits);
    message.success("Quota limits updated");

    // refresh current state for meters
    await openQuotaDrawer({ tenantId: qDrawer.value.tenantId });
  } catch (e) {
    message.error(
      e?.response?.data?.message || e.message || "Failed to update limits"
    );
  } finally {
    qDrawer.value.saving = false;
  }
}

/* nav */
function goResources(r) {
  const id = r.tenantId || r.id;
  const loc = { name: "admin-tenant-resources", params: { tenantId: id } };
  const resolved = router.resolve(loc);
  console.log("[goResources] href =", resolved.href);
  router.push(loc);
}

onMounted(fetchRows);
</script>

<style scoped>
.page {
  display: grid;
  gap: 12px;
}
</style>
