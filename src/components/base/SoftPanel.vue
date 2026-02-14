<template>
  <section class="soft-panel">
    <slot />
  </section>
</template>

<style scoped>
.soft-panel {
  border-radius: 18px;
  background: var(--surface);
  border: 1px solid #d7dee8;
  box-shadow: 0 14px 28px rgba(20, 28, 52, 0.12);
  position: relative;
  overflow: hidden;
}

.soft-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(21, 32, 64, 0.035) 1px, transparent 1px);
  background-size: 12px 12px;
  opacity: 0.4;
  pointer-events: none;
}

.soft-panel > * {
  position: relative;
  z-index: 1;
}

:global([data-theme='industrial']) .soft-panel {
  border-radius: 10px;
  box-shadow: none;
  border: 1px solid var(--border-soft);
}

:global([data-theme='industrial']) .soft-panel::after {
  opacity: 0;
}
</style>
