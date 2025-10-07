<!-- /components/admin/CreateVMButtons.vue -->
<template>
  <n-tooltip trigger="hover" :disabled="canCreate">
    <template #trigger>
      <n-button
        size="small"
        type="primary"
        :disabled="!canCreate"
        @click="openModal"
      >
        <template #icon>
          <n-icon><AddOutline /></n-icon>
        </template>
        Create a VM
      </n-button>
    </template>
    <span>{{ disabledReason }}</span>
  </n-tooltip>

  <n-modal
    v-model:show="show"
    preset="card"
    title="Create a VM"
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
      <n-form-item label="Tenant ID" path="tenantId">
        <n-input v-model:value="form.tenantId" disabled />
      </n-form-item>

      <!-- Optional agent -->
      <n-form-item label="Agent (optional)" path="agentId">
        <n-select
          v-if="agentOptions?.length"
          v-model:value="form.agentId"
          :options="agentOptions"
          placeholder="Leave empty for automatic election"
          filterable
          clearable
        />
        <n-input
          v-else
          v-model:value="form.agentId"
          placeholder="Agent ID (e.g. HOST-...) — empty = auto election"
          clearable
        />
      </n-form-item>

      <n-form-item label="VM name" path="name">
        <n-input v-model:value="form.name" placeholder="e.g. vm-demo" />
      </n-form-item>

      <!-- Image by ID -->
      <n-form-item label="Image (cloud-init)" path="imageId">
        <n-select
          v-model:value="form.imageId"
          :options="imageOptions"
          :loading="imagesLoading"
          filterable
          placeholder="Select a VHDX image — Image Repository"
        />
      </n-form-item>

      <!-- Fixed to Gen 2 -->
      <n-form-item label="Generation">
        <n-tag type="success" size="small">Gen 2 (forced)</n-tag>
      </n-form-item>

      <!-- Network profile (optional) -->
      <n-form-item label="Network profile" path="networkProfileId">
        <n-select
          v-model:value="form.networkProfileId"
          :options="networkProfileOptions"
          :loading="netProfilesLoading"
          filterable
          clearable
          placeholder="Tenant default if empty"
        />
      </n-form-item>

      <n-grid cols="1 s:2" x-gap="12">
        <n-grid-item>
          <n-form-item label="vCPU" path="cpu">
            <n-input-number v-model:value="form.cpu" :min="1" :max="64" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="RAM" path="ram">
            <n-input
              v-model:value="form.ram"
              placeholder="e.g. 2GB or 2048MB"
            />
          </n-form-item>
        </n-grid-item>
      </n-grid>

      <n-form-item label="Dynamic memory" path="dynamic_memory">
        <n-switch v-model:value="form.dynamic_memory" />
      </n-form-item>

      <n-grid cols="1 s:2" x-gap="12" v-if="form.dynamic_memory">
        <n-grid-item>
          <n-form-item label="Min RAM" path="min_ram">
            <n-input v-model:value="form.min_ram" placeholder="e.g. 1GB" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="Max RAM" path="max_ram">
            <n-input v-model:value="form.max_ram" placeholder="e.g. 4GB" />
          </n-form-item>
        </n-grid-item>
      </n-grid>

      <n-form-item label="User (VM)" path="ci_user">
        <n-input v-model:value="form.ci_user" placeholder="e.g. ubuntu" />
      </n-form-item>

      <n-form-item label="SSH public key" path="ci_ssh_key">
        <n-input
          v-model:value="form.ci_ssh_key"
          type="textarea"
          placeholder="ssh-ed25519 AAAAC3... user@host"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </n-form-item>

      <n-form-item label="Network (cloud-init)" path="ci_network_mode">
        <n-select
          v-model:value="form.ci_network_mode"
          :options="[
            { label: 'DHCP (default)', value: 'dhcp' },
            { label: 'Static', value: 'static' },
          ]"
        />
      </n-form-item>

      <n-grid v-if="form.ci_network_mode === 'static'" cols="1 s:3" x-gap="12">
        <n-grid-item>
          <n-form-item label="Address (CIDR)" path="ci_ip">
            <n-input v-model:value="form.ci_ip" placeholder="10.200.0.50/24" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="Gateway" path="ci_gw">
            <n-input v-model:value="form.ci_gw" placeholder="10.200.0.1" />
          </n-form-item>
        </n-grid-item>
        <n-grid-item>
          <n-form-item label="DNS" path="ci_dns">
            <n-input
              v-model:value="form.ci_dns"
              placeholder="1.1.1.1,9.9.9.9"
            />
          </n-form-item>
        </n-grid-item>
      </n-grid>
    </n-form>

    <template #action>
      <n-space justify="end">
        <n-button quaternary @click="show = false">Cancel</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">
          Create
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import {
  NButton,
  NIcon,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NInputNumber,
  NGrid,
  NGridItem,
  NSpace,
  NSwitch,
  NTooltip,
  NTag,
  useMessage,
} from "naive-ui";
import { ref, watch, computed } from "vue";
import { AddOutline } from "@vicons/ionicons5";
import { adminEnqueueTask } from "@/api/tasks";
import { adminImages } from "@/api/resources";
// TODO: implement this UI/API call when ready
// import { adminNetworkProfiles } from "@/api/networks";

const props = defineProps({
  tenantId: { type: String, required: true },
  agents: { type: Array, default: () => [] },
  canCreate: { type: Boolean, default: true },
  disabledReason: {
    type: String,
    default: "You don't have permission to create VMs.",
  },
});
const emit = defineEmits(["created"]);

const show = ref(false);
const submitting = ref(false);
const formRef = ref(null);
const message = useMessage();

const agentOptions = computed(() => props.agents);

// Images
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

// Network profiles
const netProfilesLoading = ref(false);
const networkProfiles = ref([]); // [{ id, name, desc? }]
const networkProfileOptions = computed(() =>
  networkProfiles.value.map((n) => ({
    label: n.name || n.id,
    value: n.id,
    meta: n,
  }))
);

const form = ref({
  tenantId: props.tenantId,
  agentId: "", // empty = auto election
  name: "",
  imageId: "",
  cpu: 2,
  ram: "2GB",
  dynamic_memory: true,
  min_ram: "1GB",
  max_ram: "4GB",
  networkProfileId: "", // optional → tenant default if empty
  ci_user: "ubuntu",
  ci_ssh_key: "",
  ci_network_mode: "dhcp",
  ci_ip: "",
  ci_gw: "",
  ci_dns: "",
});
watch(
  () => props.tenantId,
  (v) => (form.value.tenantId = v)
);

async function loadImages() {
  try {
    imagesLoading.value = true;
    const { data } = await adminImages();
    images.value = data?.data || [];
  } catch (e) {
    images.value = [];
    message.warning("Unable to load images (index unavailable?)");
  } finally {
    imagesLoading.value = false;
  }
}
async function loadNetworkProfiles() {
  try {
    netProfilesLoading.value = true;
    // const { data } = await adminNetworkProfiles({ tenantId: props.tenantId });
    // networkProfiles.value = data?.data || [];
    networkProfiles.value = []; // placeholder if API not ready
  } catch (e) {
    networkProfiles.value = [];
  } finally {
    netProfilesLoading.value = false;
  }
}
function openModal() {
  show.value = true;
  if (!images.value.length) loadImages();
  if (!networkProfiles.value.length) loadNetworkProfiles();
}

/** Rules: no switch/generation in form */
const rules = {
  tenantId: {
    required: true,
    message: "Tenant is required",
    trigger: ["blur", "change"],
  },
  name: {
    required: true,
    message: "Name is required",
    trigger: ["blur", "change"],
  },
  imageId: {
    required: true,
    message: "Image is required",
    trigger: ["blur", "change"],
  },
  cpu: {
    required: true,
    type: "number",
    message: "vCPU is required",
    trigger: "change",
  },
  ram: { required: true, message: "RAM is required", trigger: "blur" },
  ci_user: { required: true, message: "User is required", trigger: "blur" },
  ci_ssh_key: {
    required: true,
    message: "Public SSH key is required",
    trigger: "blur",
  },
  ci_ip: {
    validator: () =>
      form.value.ci_network_mode === "static" ? !!form.value.ci_ip : true,
    message: "CIDR address is required",
    trigger: "blur",
  },
  ci_gw: {
    validator: () =>
      form.value.ci_network_mode === "static" ? !!form.value.ci_gw : true,
    message: "Gateway is required",
    trigger: "blur",
  },
};

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  submitting.value = true;
  try {
    const cloudInit = {
      hostname: form.value.name,
      user: form.value.ci_user,
      ssh_authorized_keys: [form.value.ci_ssh_key],
      packages: ["qemu-guest-agent"],
      runcmd: ["systemctl enable --now qemu-guest-agent"],
      enableSerial: true,
      serialReboot: false,
      network:
        form.value.ci_network_mode === "static"
          ? {
              mode: "static",
              address: form.value.ci_ip,
              gateway: form.value.ci_gw,
              nameservers: form.value.ci_dns
                ? form.value.ci_dns
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
            }
          : { mode: "dhcp" },
    };

    const target = {
      kind: "vm",
      ...(form.value.agentId ? { agentId: form.value.agentId } : {}),
    };

    const payload = {
      tenantId: form.value.tenantId,
      target,
      action: "vm.create",
      data: {
        name: form.value.name,
        generation: 2, // forced Gen2
        ram: form.value.ram,
        cpu: form.value.cpu,
        dynamic_memory: form.value.dynamic_memory,
        ...(form.value.dynamic_memory
          ? { min_ram: form.value.min_ram, max_ram: form.value.max_ram }
          : {}),
        imageId: form.value.imageId,
        cloudInit,
        ...(form.value.networkProfileId
          ? { networkProfileId: form.value.networkProfileId }
          : {}),
      },
      meta: { capability: "vm.create" },
    };

    await adminEnqueueTask(payload);
    message.success(`Creation requested for ${form.value.name}`);
    show.value = false;
    emit("created");
  } catch (e) {
    message.error(e?.response?.data?.error || e.message || "Creation failed");
  } finally {
    submitting.value = false;
  }
}
</script>
