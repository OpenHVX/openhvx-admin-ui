<!-- src/components/admin/EditVMButton.vue -->
<template>
  <!-- Hidden trigger when used from a dropdown -->
  <n-tooltip v-if="!hideTrigger" trigger="hover">
    <template #trigger>
      <n-button size="small" quaternary @click="open">
        <template #icon>
          <n-icon><CreateOutline /></n-icon>
        </template>
        Edit
      </n-button>
    </template>
    <span>Edit this VM’s configuration</span>
  </n-tooltip>

  <n-modal
    v-model:show="show"
    preset="card"
    title="Edit VM"
    style="max-width: 720px"
  >
    <n-form
      :model="form"
      :rules="rules"
      ref="formRef"
      label-placement="left"
      label-width="180"
      @submit.prevent="submit"
    >
      <!-- Name (editable) -->
      <n-form-item label="Name" path="name">
        <n-input v-model:value="form.name" placeholder="VM name" />
      </n-form-item>

      <!-- Image (optional) -->
      <n-form-item label="Image (cloud-init)" path="imageId">
        <n-select
          v-model:value="form.imageId"
          :options="imageOptions"
          :loading="imagesLoading"
          filterable
          clearable
          placeholder="Empty = unchanged"
        />
      </n-form-item>

      <!-- CPU / RAM -->
      <n-grid cols="1 s:2" x-gap="12">
        <n-grid-item>
          <n-form-item label="vCPU" path="cpu">
            <n-input-number
              v-model:value="form.cpu"
              :min="1"
              :max="64"
              placeholder="Unchanged if empty"
            />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="RAM (startup)" path="ram">
            <n-input
              v-model:value="form.ram"
              placeholder="e.g. 2048 (MB) or 2GB — unchanged if empty"
            />
          </n-form-item>
        </n-grid-item>
      </n-grid>

      <!-- Network profile (optional) -->
      <n-form-item label="Network profile" path="networkProfileId">
        <n-select
          v-model:value="form.networkProfileId"
          :options="networkProfileOptions"
          :loading="netProfilesLoading"
          filterable
          clearable
          placeholder="Empty = unchanged"
        />
      </n-form-item>

      <!-- NOTE: Named Pipe, SecureBoot, Dynamic Memory, vSwitch intentionally NOT editable here -->
    </n-form>

    <template #action>
      <n-space justify="end">
        <n-button quaternary @click="show = false">Cancel</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">
          Save changes
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
/**
 * EditVMButton
 * - If hideTrigger=true, no button is rendered; open modal programmatically via `ref.open()`.
 * - Sends only allowed & changed fields: name (as new_name), imageId, cpu, ram, networkProfileId.
 */
import {
  NButton,
  NIcon,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NGrid,
  NGridItem,
  NSpace,
  NTooltip,
  NSelect,
  useMessage,
} from "naive-ui";
import { ref, watch, computed } from "vue";
import { CreateOutline } from "@vicons/ionicons5";
import { adminEnqueueTask } from "@/api/tasks";
import { adminImages } from "@/api/resources";
// import { adminNetworkProfiles } from "@/api/networks"; // hook when API is ready

const props = defineProps({
  vm: { type: Object, required: true }, // expects normalized row: { id|_id|guid, name, cpu, ramMB, ... }
  tenantId: { type: String, required: true },
  agentId: { type: String, default: "" },
  hideTrigger: { type: Boolean, default: false },
});
const emit = defineEmits(["updated"]);

const show = ref(false);
const submitting = ref(false);
const formRef = ref(null);
const message = useMessage();

/* ---------- Options loading ---------- */
const imagesLoading = ref(false);
const images = ref([]);
const imageOptions = computed(() =>
  images.value.map((img) => {
    const sizeGB = Math.max(1, Math.round((img.sizeBytes || 0) / 1024 ** 3));
    const meta = [
      img.os || null,
      img.arch || null,
      img.gen ? `G${img.gen}` : null,
      `${sizeGB} GB`,
    ]
      .filter(Boolean)
      .join(" • ");
    const label = img.name
      ? `${img.name} (${img.id}) • ${meta}`
      : `${img.id} • ${meta}`;
    return { label, value: img.id, meta: img };
  })
);

const netProfilesLoading = ref(false);
const networkProfiles = ref([]); // [{ id, name }]
const networkProfileOptions = computed(() =>
  networkProfiles.value.map((n) => ({ label: n.name || n.id, value: n.id }))
);

async function loadImages() {
  try {
    imagesLoading.value = true;
    const { data } = await adminImages();
    images.value = data?.data || [];
  } catch {
    images.value = [];
    message.warning("Unable to load images.");
  } finally {
    imagesLoading.value = false;
  }
}
async function loadNetworkProfiles() {
  try {
    netProfilesLoading.value = true;
    // const { data } = await adminNetworkProfiles({ tenantId: props.tenantId });
    // networkProfiles.value = data?.data || [];
    networkProfiles.value = []; // placeholder until API exists
  } catch {
    networkProfiles.value = [];
  } finally {
    netProfilesLoading.value = false;
  }
}

/* ---------- Form model ---------- */
function snapshot(vm) {
  return {
    name: vm?.name || "",
    // Keep CPU & RAM optional: if left empty, they won't be sent
    cpu: vm?.cpu ?? vm?.cpuCount ?? null,
    // vm.ramMB is MB; backend treats <=131072 as MB if numeric
    ram: vm?.ramMB ? String(vm.ramMB) : "",
    imageId: "", // user can select new image; empty = unchanged
    networkProfileId: "", // empty = unchanged
  };
}
const initial = ref(snapshot(props.vm));
const form = ref({ ...initial.value });

watch(
  () => props.vm,
  (nv) => {
    initial.value = snapshot(nv);
    form.value = { ...initial.value };
  }
);

/* ---------- Modal control ---------- */
function open() {
  // lazy-load on first open
  if (!images.value.length && !imagesLoading.value) loadImages();
  if (!networkProfiles.value.length && !netProfilesLoading.value)
    loadNetworkProfiles();
  form.value = { ...initial.value };
  show.value = true;
}
defineExpose({ open });

/* ---------- Validation ---------- */
const rules = {
  name: { required: true, message: "Name is required" },
  // cpu/ram/image/networkProfile are optional; only sent if changed/filled
};

/* ---------- Payload diff ---------- */
function buildChanges(original, edited) {
  const out = {};
  // name change → send as new_name (we still pass original name for lookup)
  if (edited.name && edited.name !== original.name) out.new_name = edited.name;

  if (edited.imageId) out.imageId = edited.imageId;

  // cpu may be number or null
  if (
    edited.cpu !== null &&
    edited.cpu !== undefined &&
    edited.cpu !== original.cpu
  ) {
    out.cpu = edited.cpu;
  }
  // ram as string/number; if not empty and changed
  if (
    edited.ram !== undefined &&
    edited.ram !== "" &&
    edited.ram !== original.ram
  ) {
    out.ram = edited.ram;
  }
  // network profile optional; include only if set and different (original is empty)
  if (edited.networkProfileId) out.networkProfileId = edited.networkProfileId;

  return out;
}

/* ---------- Submit ---------- */
async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  const changes = buildChanges(initial.value, form.value);
  if (!Object.keys(changes).length) {
    message.info("No changes.");
    show.value = false;
    return;
  }

  submitting.value = true;
  try {
    const target = { kind: "vm" };
    if (props.agentId) target.agentId = props.agentId;

    const vmId =
      props.vm?._id || props.vm?.id || props.vm?.guid || props.vm?.name;
    if (!vmId) throw new Error("Missing VM ID");

    const payload = {
      tenantId: props.tenantId,
      target,
      action: "vm.edit",
      data: {
        // lookup key stays the original name
        name: props.vm.name,
        ...changes,
      },
      meta: { capability: "vm.edit", vmId },
    };

    await adminEnqueueTask(payload);
    message.success(`Edit requested for ${props.vm.name}`);
    show.value = false;
    emit("updated");
  } catch (e) {
    message.error(e?.response?.data?.error || e.message || "Edit failed");
  } finally {
    submitting.value = false;
  }
}
</script>
