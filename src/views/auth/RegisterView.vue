<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import AuthLayout from '../../layouts/AuthLayout.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import FormField from '../../components/base/FormField.vue'
import BaseInput from '../../components/base/BaseInput.vue'
import BaseButton from '../../components/base/BaseButton.vue'

const EMAIL_SUFFIX = '@whut.edu.cn'

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({
  emailPrefix: '',
  code: '',
  nickname: '',
  password: '',
  confirmPassword: '',
})

const message = ref('')
const isError = ref(false)
const cooldown = ref(0)
let countdownTimer = null
const emailInputRef = ref(null)
const codeInputRef = ref(null)
const nicknameInputRef = ref(null)
const passwordInputRef = ref(null)
const confirmPasswordInputRef = ref(null)

const canSendCode = computed(() => cooldown.value === 0 && !authStore.codeSending)

const buildWhutEmail = (prefix) => {
  const cleanPrefix = (prefix || '').trim().toLowerCase()
  if (!cleanPrefix || cleanPrefix.includes('@')) return ''
  return `${cleanPrefix}${EMAIL_SUFFIX}`
}

const startCooldown = () => {
  cooldown.value = 60
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
      cooldown.value = 0
    }
  }, 1000)
}

const sendCode = async () => {
  const email = buildWhutEmail(form.emailPrefix)
  if (!email) {
    isError.value = true
    message.value = `请先输入正确的邮箱前缀，后缀固定为${EMAIL_SUFFIX}。`
    emailInputRef.value?.focus()
    return
  }
  try {
    await authStore.sendRegisterCode(email)
    isError.value = false
    message.value = '验证码已发送到你的邮箱。'
    startCooldown()
  } catch (error) {
    isError.value = true
    message.value = error?.message || '验证码发送失败，请稍后重试。'
  }
}

const submit = async () => {
  const email = buildWhutEmail(form.emailPrefix)
  if (!email) {
    isError.value = true
    message.value = `请输入邮箱前缀，后缀固定为${EMAIL_SUFFIX}。`
    emailInputRef.value?.focus()
    return
  }
  if (!form.code) {
    isError.value = true
    message.value = '请输入验证码。'
    codeInputRef.value?.focus?.()
    return
  }
  if (!form.nickname) {
    isError.value = true
    message.value = '请输入昵称。'
    nicknameInputRef.value?.focus?.()
    return
  }
  if (!form.password) {
    isError.value = true
    message.value = '请输入密码。'
    passwordInputRef.value?.focus?.()
    return
  }
  if (!form.confirmPassword) {
    isError.value = true
    message.value = '请再次输入密码。'
    confirmPasswordInputRef.value?.focus?.()
    return
  }
  if (form.password !== form.confirmPassword) {
    isError.value = true
    message.value = '两次输入的密码不一致。'
    confirmPasswordInputRef.value?.focus?.()
    return
  }

  try {
    await authStore.register({
      email,
      code: form.code.trim(),
      nickname: form.nickname.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
    })
    isError.value = false
    message.value = '注册成功，正在跳转登录页…'
    setTimeout(() => router.push('/login'), 600)
  } catch (error) {
    isError.value = true
    message.value = error?.message || '注册失败，请稍后重试。'
  }
}

onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})
</script>

<template>
  <AuthLayout title="创建账号" subtitle="通过邮箱验证码完成注册。">
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

        <FormField label="验证码">
          <div class="inline-row">
            <BaseInput
              v-model="form.code"
              ref="codeInputRef"
              name="code"
              placeholder="4位验证码… 例：1234"
              autocomplete="one-time-code"
              inputmode="numeric"
              pattern="\\d{4}"
              :spellcheck="false"
            />
            <button class="code-btn" type="button" :disabled="!canSendCode" @click="sendCode">
              {{ cooldown > 0 ? `${cooldown}s` : '发送验证码' }}
            </button>
          </div>
        </FormField>

        <FormField label="昵称">
          <BaseInput
            v-model="form.nickname"
            ref="nicknameInputRef"
            name="nickname"
            placeholder="请输入昵称… 例：小明"
            autocomplete="nickname"
          />
        </FormField>

        <FormField label="密码">
          <BaseInput
            v-model="form.password"
            ref="passwordInputRef"
            name="password"
            type="password"
            autocomplete="new-password"
            placeholder="请输入密码… 例：8-20位"
          />
        </FormField>

        <FormField label="确认密码">
          <BaseInput
            v-model="form.confirmPassword"
            ref="confirmPasswordInputRef"
            name="confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="请再次输入密码… 例：8-20位"
          />
        </FormField>

        <p v-if="message" class="msg" :class="{ error: isError }" :role="isError ? 'alert' : 'status'" aria-live="polite">
          {{ message }}
        </p>

        <BaseButton type="submit" :loading="authStore.loading">注册</BaseButton>
        <BaseButton type="button" variant="ghost" @click="$router.push('/login')">返回登录</BaseButton>
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

.inline-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.6rem;
}

.code-btn {
  min-width: 108px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  padding: 0 0.9rem;
  color: var(--text-primary);
  background: var(--surface-2);
  cursor: pointer;
  transition: var(--transition);
}

.code-btn:hover:not(:disabled) {
  background: #e4ebf4;
}

.code-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.code-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.msg {
  font-size: 0.84rem;
  color: var(--accent);
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.7rem;
}

.msg.error {
  color: #9f4a46;
  background: #fef2f2;
  border-color: #fecaca;
}
</style>
