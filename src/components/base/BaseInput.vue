<script setup>
import { ref } from 'vue'

const model = defineModel({ type: String, default: '' })
const inputRef = ref(null)

const props = defineProps({
  type: {
    type: String,
    default: 'text',
  },
  placeholder: {
    type: String,
    default: '',
  },
  autocomplete: {
    type: String,
    default: 'off',
  },
  name: {
    type: String,
    default: '',
  },
  inputmode: {
    type: String,
    default: null,
  },
  pattern: {
    type: String,
    default: null,
  },
  autocapitalize: {
    type: String,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  spellcheck: {
    type: Boolean,
    default: null,
  },
})

defineExpose({
  focus: () => inputRef.value?.focus(),
})
</script>

<template>
  <input
    ref="inputRef"
    v-model="model"
    class="base-input"
    :type="props.type"
    :placeholder="props.placeholder"
    :autocomplete="props.autocomplete"
    :name="props.name || null"
    :inputmode="props.inputmode"
    :pattern="props.pattern"
    :autocapitalize="props.autocapitalize"
    :disabled="props.disabled"
    :spellcheck="props.spellcheck"
  />
</template>

<style scoped>
.base-input {
  width: 100%;
  min-height: 46px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: #f7f9fc;
  color: var(--text-primary);
  outline: none;
  padding: 0.72rem 0.9rem;
  font-size: 0.95rem;
  transition: var(--transition);
}

:global([data-theme='industrial']) .base-input {
  border-radius: 6px;
  background: #ffffff;
  box-shadow: none;
  padding: 0.6rem 0.8rem;
  font-size: 0.9rem;
}

.base-input::placeholder {
  color: var(--text-tertiary);
}

.base-input:hover {
  border-color: #c3cfe0;
}

.base-input:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--focus-ring);
  background: #ffffff;
}

.base-input:focus {
  border-color: var(--accent);
}
</style>
