<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import AuthLayout from '../../layouts/AuthLayout.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import FormField from '../../components/base/FormField.vue'
import BaseInput from '../../components/base/BaseInput.vue'
import BaseButton from '../../components/base/BaseButton.vue'

const EMAIL_SUFFIX = '@whut.edu.cn'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  emailPrefix: '',
  password: '',
})

const errorMessage = ref('')
const emailInputRef = ref(null)
const passwordInputRef = ref(null)

const buildWhutEmail = (prefix) => {
  const cleanPrefix = (prefix || '').trim().toLowerCase()
  if (!cleanPrefix || cleanPrefix.includes('@')) return ''
  return `${cleanPrefix}${EMAIL_SUFFIX}`
}

const submit = async () => {
  const email = buildWhutEmail(form.emailPrefix)
  if (!email || !form.password) {
    if (!email) {
      errorMessage.value = `请输入邮箱前缀，邮箱后缀固定为${EMAIL_SUFFIX}。`
      emailInputRef.value?.focus()
      return
    }
    errorMessage.value = '请输入密码。'
    passwordInputRef.value?.focus?.()
    return
  }

  try {
    errorMessage.value = ''
    await authStore.login({
      email,
      password: form.password,
    })
    const redirect = route.query.redirect || '/profile'
    router.push(redirect)
  } catch (error) {
    errorMessage.value = error?.message || '登录失败，请稍后重试。'
  }
}
</script>

<template>
  <AuthLayout title="欢迎回来" subtitle="学习雷锋好榜样。" watermark="失物招领">
    <SoftPanel class="panel">
      <form class="form" @submit.prevent="submit">
        <FormField label="校园邮箱">
          <div class="email-combo">
            <input
              v-model="form.emailPrefix"
              class="email-prefix-input"
              type="text"
              name="emailPrefix"
              ref="emailInputRef"
              autocomplete="username"
              inputmode="email"
              autocapitalize="none"
              spellcheck="false"
              placeholder="请输入邮箱前缀… 例：20201234"
            />
            <span class="suffix">{{ EMAIL_SUFFIX }}</span>
          </div>
        </FormField>

        <FormField label="密码">
          <BaseInput
            v-model="form.password"
            ref="passwordInputRef"
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码… 例：8-20位"
          />
        </FormField>

        <p v-if="errorMessage" class="error-msg" role="alert" aria-live="polite">{{ errorMessage }}</p>

        <BaseButton type="submit" :loading="authStore.loading">登录</BaseButton>
        <BaseButton type="button" variant="ghost" @click="$router.push('/register')">创建账号</BaseButton>
      </form>
    </SoftPanel>
  </AuthLayout>
</template>

<style scoped>
.panel {
  padding: 1.45rem;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
}

.form {
  display: grid;
  gap: 1rem;
}

.email-combo {
  display: flex;
  align-items: center;
  min-height: 46px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
  transition: var(--transition);
}

.email-combo:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.email-prefix-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  padding: 0 0.9rem;
  font-size: 0.95rem;
}

.email-prefix-input::placeholder {
  color: var(--text-tertiary);
}

.suffix {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  padding: 0 0.75rem;
  background: var(--surface-2);
  color: var(--text-secondary);
  font-size: 0.9rem;
  white-space: nowrap;
  border-left: 1px solid var(--border-soft);
}

.error-msg {
  font-size: 0.84rem;
  color: #9f4a46;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.7rem;
}
</style>
