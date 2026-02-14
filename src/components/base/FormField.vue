<script setup>
const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  hint: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <label class="form-field">
    <div class="head">
      <span class="label">{{ props.label }}</span>
      <span v-if="props.hint" class="hint">{{ props.hint }}</span>
    </div>
    <slot />
    <p v-if="props.error" class="error">{{ props.error }}</p>
  </label>
</template>

<style scoped>
.form-field {
  display: grid;
  gap: 0.5rem;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
}

.label {
  font-size: 0.9rem;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.hint {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.error {
  font-size: 0.8rem;
  color: #9f4a46;
}
</style>
