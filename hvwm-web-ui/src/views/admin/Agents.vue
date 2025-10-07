<template>
  <PageToolbar title="Agents" />
  <n-data-table :columns="cols" :data="rows" :loading="loading" />
</template>

<script setup>
import { onMounted, ref } from "vue";
import { listAgents } from "@/api/agents";
import { useApi } from "@/composables/useApi";

const rows = ref([]);
const loading = ref(false);
const { guard } = useApi();
const cols = [
  { title: "Agent", key: "id" },
  { title: "Host", key: "host" },
  { title: "Version", key: "version" },
  { title: "Status", key: "status" },
];

onMounted(async () => {
  loading.value = true;
  try {
    rows.value = await guard(listAgents());
  } finally {
    loading.value = false;
  }
});
</script>
