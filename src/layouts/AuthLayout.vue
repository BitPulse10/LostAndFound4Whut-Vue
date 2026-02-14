<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  watermark: {
    type: String,
    default: '',
  },
})

const watermarkChars = computed(() => (props.watermark ? props.watermark.split('') : []))
</script>

<template>
  <main class="auth-layout">
    <p v-if="props.watermark" class="watermark" aria-hidden="true">
      <span v-for="(char, index) in watermarkChars" :key="`${char}-${index}`" class="wm-char">{{ char }}</span>
    </p>

    <section class="intro">
      <p class="badge">武理智寻</p>
      <h1>{{ props.title }}</h1>
      <p class="subtitle">{{ props.subtitle }}</p>
    </section>

    <div class="form-slot">
      <slot />
    </div>
  </main>
</template>

<style scoped>
.auth-layout {
  position: relative;
  width: min(980px, 92vw);
  margin: 0 auto;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(260px, 0.82fr) minmax(320px, 420px);
  gap: clamp(0.2rem, 1vw, 0.8rem);
  align-items: center;
  overflow: visible;
}

.watermark {
  pointer-events: none;
  position: absolute;
  right: clamp(-2.35rem, -2.2vw, -1.35rem);
  top: 52%;
  transform: translateY(-50%);
  font-size: clamp(5.1rem, 19vw, 14.2rem);
  font-weight: 800;
  letter-spacing: 0.08em;
  color: rgba(37, 99, 235, 0.12);
  user-select: none;
  white-space: nowrap;
  z-index: 4;
}

.wm-char {
  display: inline-block;
}

.wm-char:nth-child(1) {
  transform: translateY(-8%);
}

.wm-char:nth-child(2) {
  transform: translateY(6%);
}

.wm-char:nth-child(3) {
  transform: translateY(-4%);
}

.wm-char:nth-child(4) {
  transform: translateY(7%);
}

.intro {
  position: relative;
  z-index: 2;
  padding: clamp(2rem, 4vw, 4rem) clamp(0.55rem, 1.1vw, 1rem) clamp(2rem, 4vw, 4rem)
    clamp(2rem, 4vw, 4rem);
}

.form-slot {
  position: relative;
  z-index: 2;
}

.badge {
  display: inline-block;
  border-radius: var(--radius-md);
  padding: 0.38rem 0.82rem;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--accent-light);
  border: 1px solid #dbeafe;
}

h1 {
  margin-top: 1.2rem;
  font-size: clamp(2.2rem, 6vw, 4rem);
  line-height: 1.06;
  color: var(--text-primary);
  letter-spacing: -0.03em;
}

.subtitle {
  margin-top: 1rem;
  max-width: 36ch;
  font-size: 1rem;
  color: var(--text-secondary);
}

@media (max-width: 960px) {
  .auth-layout {
    grid-template-columns: 1fr;
    align-content: center;
    gap: 1.4rem;
    padding: 2.2rem 0;
  }

  .watermark {
    right: -0.75rem;
    top: 34%;
    transform: translateY(-50%);
    font-size: clamp(3.6rem, 21vw, 7.2rem);
    letter-spacing: 0.05em;
  }

  .intro {
    padding-bottom: 0;
  }
}
</style>
