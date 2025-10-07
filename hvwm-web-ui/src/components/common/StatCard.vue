<template>
  <n-card
    :segmented="{ content: true, footer: true }"
    :bordered="true"
    size="small"
    class="stat-card"
  >
    <div class="top">
      <div class="title">{{ title }}</div>
      <slot name="extra" />
    </div>
    <div class="value">
      <slot>{{ value }}</slot>
    </div>
    <template #footer>
      <slot name="footer" />
    </template>
  </n-card>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], default: "" },
});
</script>

<style scoped>
.stat-card .top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  opacity: 0.8;
}
.value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  margin-top: 4px;
}
</style>
