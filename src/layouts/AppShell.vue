<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const TXT = {
  brand: '武理智寻',
  home: '首页',
  profile: '个人中心',
  login: '登录',
  register: '注册',
  logout: '退出登录',
}

const logout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <header class="topbar">
      <div class="brand">
        <span class="logo"></span>
        <div>
          <h1>{{ TXT.brand }}</h1>
        </div>
      </div>
      <nav class="actions">
        <RouterLink class="link" to="/home">{{ TXT.home }}</RouterLink>
        <template v-if="authStore.isLoggedIn">
          <RouterLink class="link" to="/profile">{{ TXT.profile }}</RouterLink>
          <button class="link ghost" type="button" @click="logout">{{ TXT.logout }}</button>
        </template>
        <template v-else>
          <RouterLink class="link" to="/login">{{ TXT.login }}</RouterLink>
          <RouterLink class="link ghost" to="/register">{{ TXT.register }}</RouterLink>
        </template>
      </nav>
    </header>
    <main id="main-content" class="content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  width: min(1200px, 92vw);
  margin: 0 auto;
  min-height: 100vh;
  padding: 2.2rem 0 4rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid #e2e8f0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.logo {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #1d4ed8;
  box-shadow: 0 10px 22px rgba(29, 78, 216, 0.22);
  position: relative;
}

.logo::after {
  content: '';
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.85);
}

.brand h1 {
  font-size: 1.8rem;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.link {
  border: 1px solid #dbe4f0;
  text-decoration: none;
  color: var(--text-secondary);
  background: #fff;
  border-radius: 999px;
  padding: 0.45rem 1rem;
  font-size: 0.86rem;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.link:hover {
  color: var(--text-primary);
  border-color: #c4d4ec;
  transform: translateY(-1px);
}

.link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.ghost {
  background: #f5f7fb;
}

.content {
  padding: 0;
}

.skip-link {
  position: absolute;
  left: 1rem;
  top: 0.5rem;
  padding: 0.4rem 0.8rem;
  background: #0f172a;
  color: #ffffff;
  border-radius: 999px;
  text-decoration: none;
  transform: translateY(-200%);
  transition: transform 0.2s ease;
  z-index: 10;
}

.skip-link:focus {
  transform: translateY(0);
}

@media (max-width: 720px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>
