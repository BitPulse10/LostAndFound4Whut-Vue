import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/auth/LoginView.vue'
import RegisterView from '../views/auth/RegisterView.vue'
import ProfileView from '../views/user/ProfileView.vue'
import ItemDetailView from '../views/item/ItemDetailView.vue'
import HomeView from '../views/home/HomeView.vue'

const TOKEN_KEY = 'laf_token'
const REFRESH_TOKEN_KEY = 'laf_refresh_token'
const USER_KEY = 'laf_user'

const clearAuthState = () => {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(window.atob(payloadBase64))))
    if (!payload?.exp) return false
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

const routes = [
  {
    path: '/',
    redirect: () => (isTokenValid(sessionStorage.getItem(TOKEN_KEY)) ? '/home' : '/login'),
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { guestOnly: true },
  },
  {
    path: '/home',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true },
  },
  {
    path: '/items/:id',
    name: 'item-detail',
    component: ItemDetailView,
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const tokenValid = isTokenValid(token)

  if (token && !tokenValid) {
    clearAuthState()
  }

  if (to.meta.requiresAuth && !tokenValid) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && tokenValid) {
    return { name: 'profile' }
  }

  return true
})

export default router
