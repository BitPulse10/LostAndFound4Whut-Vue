<script setup>
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resetPasswordApi, sendPasswordResetCodeApi } from '../../services/auth.api'
import AuthLayout from '../../layouts/AuthLayout.vue'
import BaseButton from '../../components/base/BaseButton.vue'
import BaseInput from '../../components/base/BaseInput.vue'
import FormField from '../../components/base/FormField.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import { useAuthStore } from '../../stores/auth'

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
const forgotOpen = ref(false)
const forgotSendingCode = ref(false)
const forgotSubmitting = ref(false)
const forgotError = ref('')
const forgotSuccess = ref('')
const forgotCooldown = ref(0)
let forgotCooldownTimer
const forgotForm = reactive({
  emailPrefix: '',
  code: '',
  password: '',
  confirmPassword: '',
})

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
    const redirect = route.query.redirect || '/home'
    router.push(redirect)
  } catch (error) {
    errorMessage.value = error?.message || '登录失败，请稍后重试。'
  }
}

const openForgot = () => {
  forgotOpen.value = true
  forgotError.value = ''
  forgotSuccess.value = ''
  forgotForm.emailPrefix = form.emailPrefix
  forgotForm.code = ''
  forgotForm.password = ''
  forgotForm.confirmPassword = ''
}

const closeForgot = () => {
  forgotOpen.value = false
  forgotError.value = ''
}

const startForgotCooldown = () => {
  forgotCooldown.value = 60
  clearInterval(forgotCooldownTimer)
  forgotCooldownTimer = setInterval(() => {
    if (forgotCooldown.value <= 1) {
      forgotCooldown.value = 0
      clearInterval(forgotCooldownTimer)
      forgotCooldownTimer = null
      return
    }
    forgotCooldown.value -= 1
  }, 1000)
}

const sendForgotCode = async () => {
  if (forgotSendingCode.value || forgotCooldown.value > 0) return
  const email = buildWhutEmail(forgotForm.emailPrefix)
  forgotError.value = ''
  forgotSuccess.value = ''
  if (!email) {
    forgotError.value = `请输入邮箱前缀，邮箱后缀固定为${EMAIL_SUFFIX}。`
    return
  }
  forgotSendingCode.value = true
  try {
    await sendPasswordResetCodeApi({ email })
    forgotSuccess.value = '验证码已发送，请前往邮箱查看。'
    startForgotCooldown()
  } catch (error) {
    forgotError.value = error?.message || '验证码发送失败，请稍后重试。'
  } finally {
    forgotSendingCode.value = false
  }
}

const submitForgot = async () => {
  if (forgotSubmitting.value) return
  const email = buildWhutEmail(forgotForm.emailPrefix)
  forgotError.value = ''
  forgotSuccess.value = ''
  if (!email) {
    forgotError.value = `请输入邮箱前缀，邮箱后缀固定为${EMAIL_SUFFIX}。`
    return
  }
  if (!forgotForm.code.trim()) {
    forgotError.value = '请输入邮箱验证码。'
    return
  }
  if (!forgotForm.password || forgotForm.password.length < 6) {
    forgotError.value = '新密码长度至少为 6 位。'
    return
  }
  if (forgotForm.password !== forgotForm.confirmPassword) {
    forgotError.value = '两次输入的新密码不一致。'
    return
  }
  forgotSubmitting.value = true
  try {
    await resetPasswordApi({
      email,
      code: forgotForm.code.trim(),
      password: forgotForm.password,
      confirmPassword: forgotForm.confirmPassword,
    })
    forgotSuccess.value = '密码重置成功，请使用新密码登录。'
  } catch (error) {
    forgotError.value = error?.message || '密码重置失败，请稍后重试。'
  } finally {
    forgotSubmitting.value = false
  }
}

onBeforeUnmount(() => {
  clearInterval(forgotCooldownTimer)
})
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

        <button class="forgot-trigger" type="button" @click="openForgot">忘记密码？</button>

        <p v-if="errorMessage" class="error-msg" role="alert" aria-live="polite">{{ errorMessage }}</p>

        <BaseButton type="submit" :loading="authStore.loading">登录</BaseButton>
        <BaseButton type="button" variant="ghost" @click="$router.push('/register')">创建账号</BaseButton>
      </form>

      <section v-if="forgotOpen" class="forgot-panel">
        <header class="forgot-head">
          <h3>重置密码</h3>
          <button type="button" class="forgot-close" aria-label="关闭重置密码" @click="closeForgot">&times;</button>
        </header>
        <form class="forgot-form" @submit.prevent="submitForgot">
          <FormField label="校园邮箱">
            <div class="email-combo">
              <input
                v-model="forgotForm.emailPrefix"
                class="email-prefix-input"
                type="text"
                name="forgotEmailPrefix"
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
            <div class="forgot-code-row">
              <BaseInput v-model="forgotForm.code" name="code" type="text" placeholder="请输入邮箱验证码" />
              <button class="send-code-btn" type="button" :disabled="forgotSendingCode || forgotCooldown > 0" @click="sendForgotCode">
                {{ forgotSendingCode ? '发送中…' : forgotCooldown > 0 ? `${forgotCooldown}s后重发` : '发送验证码' }}
              </button>
            </div>
          </FormField>
          <FormField label="新密码">
            <BaseInput v-model="forgotForm.password" name="newPassword" type="password" placeholder="至少 6 位" />
          </FormField>
          <FormField label="确认新密码">
            <BaseInput v-model="forgotForm.confirmPassword" name="confirmNewPassword" type="password" placeholder="再次输入新密码" />
          </FormField>
          <p v-if="forgotSuccess" class="success-msg" role="status" aria-live="polite">{{ forgotSuccess }}</p>
          <p v-if="forgotError" class="error-msg" role="alert" aria-live="polite">{{ forgotError }}</p>
          <BaseButton type="submit" :loading="forgotSubmitting">确认重置</BaseButton>
        </form>
      </section>
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

.success-msg {
  font-size: 0.84rem;
  color: #0f766e;
  background: #ecfeff;
  border: 1px solid #99f6e4;
  border-radius: var(--radius-sm);
  padding: 0.55rem 0.7rem;
}

.forgot-trigger {
  justify-self: end;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
}

.forgot-trigger:hover {
  text-decoration: underline;
}

.forgot-panel {
  margin-top: 1rem;
  border: 1px solid #dbe7fb;
  border-radius: 14px;
  background: #f7faff;
  padding: 0.95rem;
}

.forgot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}

.forgot-head h3 {
  margin: 0;
  font-size: 0.95rem;
  color: #17408e;
}

.forgot-close {
  border: none;
  background: transparent;
  font-size: 1.25rem;
  color: #64748b;
  cursor: pointer;
  line-height: 1;
}

.forgot-form {
  display: grid;
  gap: 0.75rem;
}

.forgot-code-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.send-code-btn {
  border: 1px solid #bdd2f5;
  border-radius: 10px;
  background: #edf4ff;
  color: #1e429f;
  font-weight: 600;
  padding: 0.55rem 0.75rem;
  cursor: pointer;
  white-space: nowrap;
}

.send-code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .forgot-code-row {
    grid-template-columns: 1fr;
  }
}
</style>
