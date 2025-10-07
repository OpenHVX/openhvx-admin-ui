<!-- /src/components/common/PageToolbar.vue -->
<template>
  <div class="page-toolbar" :class="{ bordered: showDivider }">
    <!-- Left: title / subtitle -->
    <div class="title-wrap">
      <div class="title-line">
        <h2 class="title">{{ title }}</h2>
        <slot name="badges" />
      </div>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
      <slot name="left" />
    </div>

    <!-- Right: actions / search -->
    <div class="actions-wrap">
      <slot name="actions" />

      <n-input
        v-if="searchable"
        :value="modelValue"
        :placeholder="searchPlaceholder"
        size="small"
        clearable
        @update:value="onSearch"
        style="max-width: 280px"
      >
        <template #prefix>
          <n-icon><SearchOutline /></n-icon>
        </template>
      </n-input>

      <n-button
        v-if="refreshable"
        quaternary
        size="small"
        :loading="loading"
        @click="$emit('refresh')"
        title="Refresh"
        aria-label="Refresh"
      >
        <template #icon>
          <n-icon><RefreshOutline /></n-icon>
        </template>
        Refresh
      </n-button>

      <n-button
        v-if="showCreate"
        type="primary"
        size="small"
        @click="$emit('create')"
      >
        <template #icon>
          <n-icon><AddOutline /></n-icon>
        </template>
        {{ createLabel }}
      </n-button>
    </div>
  </div>

  <!-- Default slot: strip below toolbar (filters, extra info, etc.) -->
  <div v-if="$slots.default" class="below">
    <slot />
  </div>
</template>

<script setup>
import { SearchOutline, RefreshOutline, AddOutline } from "@vicons/ionicons5";

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  showDivider: { type: Boolean, default: true },

  // Search
  searchable: { type: Boolean, default: false },
  modelValue: { type: String, default: "" },
  searchPlaceholder: { type: String, default: "Search…" },

  // Actions
  refreshable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  showCreate: { type: Boolean, default: false },
  createLabel: { type: String, default: "Create" },
});

const emit = defineEmits(["update:modelValue", "refresh", "create"]);

function onSearch(v) {
  emit("update:modelValue", v);
}
</script>

<style scoped>
.page-toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 4px 0 12px;
  margin-bottom: 8px;
  border-bottom: 1px solid transparent;
}
.page-toolbar.bordered {
  border-color: var(--n-border-color);
}

.title-wrap {
  min-width: 0;
}
.title-line {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.title {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.1;
  margin: 0;
}
.subtitle {
  margin: 2px 0 0 0;
  opacity: 0.72;
  font-size: 12px;
}

.actions-wrap {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.below {
  margin-bottom: 12px;
}

/* Responsive */
@media (max-width: 700px) {
  .page-toolbar {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .actions-wrap {
    justify-content: flex-start;
  }
}
</style>
