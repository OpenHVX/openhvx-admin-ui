<!-- src/views/admin/Tenants.vue -->
<template>
  <div class="page">
    <!-- ===== Toolbar (title + quick actions) ===== -->
    <page-toolbar
      title="Tenants"
      subtitle="Manage tenant spaces"
      :show-divider="true"
    >
      <template #actions>
        <n-space :size="8" wrap>
          <!-- Quick search: id or display name -->
          <n-input
            v-model:value="q"
            size="small"
            placeholder="Search (id, name)…"
            clearable
            style="max-width: 260px"
          >
            <template #prefix>
              <n-icon><SearchOutline /></n-icon>
            </template>
          </n-input>

          <!-- Manual refresh (useful if autosync isn't hooked yet) -->
          <n-button
            size="small"
            quaternary
            :loading="loading"
            @click="fetchRows"
            title="Refresh"
          >
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
            Refresh
          </n-button>

          <!-- Create a new tenant -->
          <n-button size="small" type="primary" @click="openCreate">
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            New tenant
          </n-button>
        </n-space>
      </template>
    </page-toolbar>

    <!-- ===== Tenants table ===== -->
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

    <!-- ===== Create / Edit drawer =====
         Keep the surface small and focused; we only edit core metadata here. -->
    <n-drawer v-model:show="drawer.show" :width="420" placement="right">
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
  </div>
</template>

<script setup>
/*
  Tenants screen (admin).
  - Keep actions discoverable: row is clickable, kebab menu for destructive ops.
  - Drawer handles both create & edit to reduce surface.
*/
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
  useMessage,
  useDialog,
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
import { h, onMounted, ref, computed } from "vue";
import PageToolbar from "@/components/common/PageToolbar.vue";
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
} from "@/api/tenants";
import { useRouter } from "vue-router";

/* ----- routing / UI services ----- */
const router = useRouter();
const message = useMessage();
const dialog = useDialog();

/* ----- reactive state ----- */
const loading = ref(true);
const rows = ref([]);
const q = ref("");

const drawer = ref({ show: false, mode: "create", editingId: null });
const formRef = ref(null);
const form = ref({ tenantId: "", name: "", description: "" });
const saving = ref(false);

/* ----- validation rules (keep messages short and useful) ----- */
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

/* ----- small helpers ----- */
const renderIcon = (icon) => () => h(NIcon, null, { default: () => h(icon) });

/* Row menu: keep the wording explicit, avoid surprises */
function makeRowMenu(row) {
  return [
    { key: "open", label: "View resources", icon: renderIcon(OpenOutline) },
    { key: "edit", label: "Edit", icon: renderIcon(CreateOutline) },
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
  if (key === "del") return confirmDelete(row);
}

/* Row click should navigate, unless the click was on a control element */
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

/* ----- filtering (id + name) ----- */
const filteredRows = computed(() => {
  const term = (q.value || "").toLowerCase().trim();
  if (!term) return rows.value;
  return rows.value.filter((r) => {
    const id = String(r.tenantId || r.id || "").toLowerCase();
    const name = String(r.name || r.displayName || "").toLowerCase();
    return id.includes(term) || name.includes(term);
  });
});

/* Quick, readable date formatting for the list */
function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
}

/* ----- table columns ----- */
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
    width: 60,
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

/* ----- data loading ----- */
async function fetchRows() {
  loading.value = true;
  try {
    const raw = await listTenants();
    const data = raw?.data?.data;
    // Handle both array and { items, total } shapes
    rows.value = Array.isArray(data) ? data : data.items || [];
  } catch (e) {
    message.error(
      e?.response?.data?.error || e.message || "Failed to load tenants"
    );
  } finally {
    loading.value = false;
  }
}

/* ----- create / edit flow ----- */
function openCreate() {
  drawer.value = { show: true, mode: "create", editingId: null };
  form.value = { tenantId: "", name: "", description: "" };
}

function openEdit(r) {
  drawer.value = { show: true, mode: "edit", editingId: r.tenantId || r.id };
  form.value = {
    tenantId: r.tenantId || r.id,
    name: r.name || r.displayName || "",
    description: r.description || "",
  };
}

async function onSubmit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    if (drawer.value.mode === "create") {
      await createTenant({
        tenantId: form.value.tenantId,
        name: form.value.name,
        description: form.value.description,
      });
      message.success("Tenant created");
    } else {
      await updateTenant(drawer.value.editingId, {
        name: form.value.name,
        description: form.value.description,
      });
      message.success("Tenant updated");
    }
    drawer.value.show = false;
    fetchRows();
  } catch (e) {
    message.error(e?.response?.data?.error || e.message || "Operation failed");
  } finally {
    saving.value = false;
  }
}

/* ----- delete flow (confirm first) ----- */
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
          e?.response?.data?.error || e.message || "Deletion failed"
        );
      }
    },
  });
}

/* ----- navigate to tenant resources ----- */
function goResources(r) {
  const id = r.tenantId || r.id;
  const loc = { name: "admin-tenant-resources", params: { tenantId: id } };
  // Keeping these logs for now; handy when route encoding acts up.
  const resolved = router.resolve(loc);
  console.log("[goResources] loc =", loc);
  console.log("[goResources] href =", resolved.href);
  console.log("[goResources] route =", resolved);
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
