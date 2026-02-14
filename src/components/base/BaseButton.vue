<script setup>
const props = defineProps({
  type: {
    type: String,
    default: 'button',
  },
  variant: {
    type: String,
    default: 'primary',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <button :type="props.type" class="base-button" :class="`is-${props.variant}`" :disabled="props.disabled || props.loading">
    <span v-if="props.loading" class="loading-dot"></span>
    <span><slot /></span>
  </button>
</template>

<style scoped>
.base-button {
  width: 100%;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  min-height: 46px;
  padding: 0.72rem 1.4rem;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.52rem;
  transition: var(--transition);
  cursor: pointer;
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.is-primary {
  color: #ffffff;
  background: linear-gradient(135deg, var(--accent), #3a63f0);
  box-shadow: var(--shadow-md);
  border-color: var(--accent);
}

:global([data-theme='industrial']) .base-button {
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.84rem;
  box-shadow: none;
}

:global([data-theme='industrial']) .is-primary {
  background: var(--accent);
}

:global([data-theme='industrial']) .is-primary:hover:not(:disabled) {
  transform: none;
  background: var(--accent-hover);
  box-shadow: none;
}

:global([data-theme='industrial']) .is-secondary,
:global([data-theme='industrial']) .is-ghost {
  box-shadow: none;
}

.is-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  background: linear-gradient(135deg, var(--accent-hover), #2f53db);
  box-shadow: 0 8px 18px rgba(24, 33, 64, 0.28);
}

.is-secondary {
  color: var(--text-primary);
  background: var(--surface-2);
  border-color: var(--border-soft);
  box-shadow: var(--shadow-sm);
}

.is-secondary:hover:not(:disabled) {
  background: #e3e9f2;
}

.is-ghost {
  color: var(--text-secondary);
  background: transparent;
  border-color: var(--border-soft);
}

.is-ghost:hover:not(:disabled) {
  color: var(--text-primary);
  background: #eef2f7;
}

.base-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.loading-dot {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.82;
  animation: pulse 900ms ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.14);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-button {
    transition: none;
  }

  .loading-dot {
    animation: none;
  }

  .is-primary:hover:not(:disabled) {
    transform: none;
  }
}
</style>
