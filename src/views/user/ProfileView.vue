<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppShell from '../../layouts/AppShell.vue'
import { useAuthStore } from '../../stores/auth'
import { filterItemsApi, getItemDetailByIdApi } from '../../services/item.api'

const authStore = useAuthStore()
const loading = ref(false)
const error = ref('')
const postCount = ref(0)
const myPosts = ref([])
const selectedPostType = ref('all')

const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailItem = ref(null)
const detailImages = ref([])
const activeImageIndex = ref(0)

const nickname = computed(() => authStore.user?.nickname || '未设置昵称')
const email = computed(() => authStore.user?.email || '-')
const activeImageUrl = computed(() => detailImages.value[activeImageIndex.value] || '')
const foundCount = computed(() => myPosts.value.filter((item) => item.type === 1).length)
const lostCount = computed(() => myPosts.value.filter((item) => item.type === 0).length)
const cardCount = computed(() => myPosts.value.filter((item) => item.type === 2).length)
const postTypeOptions = [
  { value: 'all', label: '全部' },
  { value: 0, label: '失物' },
  { value: 1, label: '招领' },
  { value: 2, label: '卡证' },
]
const filteredPosts = computed(() => {
  if (selectedPostType.value === 'all') return myPosts.value
  return myPosts.value.filter((item) => item.type === selectedPostType.value)
})

const formatDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const normalizeDetailImageUrl = (value) => {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  const lower = raw.toLowerCase()
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('/dev-local-images/')) {
    return raw
  }
  if (lower.startsWith('file://')) {
    const localPath = raw.replace(/^file:\/+/, '').replace(/\\/g, '/')
    return `/dev-local-images/${encodeURI(localPath)}`
  }
  if (/^[a-zA-Z]:[\\/]/.test(raw)) {
    const localPath = raw.replace(/\\/g, '/')
    return `/dev-local-images/${encodeURI(localPath)}`
  }
  return ''
}

const attachPostCoverImages = async (posts) => {
  if (!Array.isArray(posts) || !posts.length) return
  await Promise.all(
    posts.map(async (post) => {
      if (!post?.id || post.coverUrl) return
      try {
        const detail = await getItemDetailByIdApi(post.id)
        const first = Array.isArray(detail?.imageUrls) ? detail.imageUrls[0] : ''
        const normalized = normalizeDetailImageUrl(first)
        if (normalized) post.coverUrl = normalized
      } catch {
        // ignore per-item failures
      }
    }),
  )
}

const openDetail = async (itemId) => {
  detailOpen.value = true
  detailLoading.value = true
  detailError.value = ''
  detailItem.value = null
  detailImages.value = []
  activeImageIndex.value = 0

  try {
    const item = await getItemDetailByIdApi(itemId)
    detailItem.value = item
    detailImages.value = Array.isArray(item?.imageUrls) ? item.imageUrls.map(normalizeDetailImageUrl).filter(Boolean) : []
  } catch (e) {
    detailError.value = e?.message || '加载详情失败'
  } finally {
    detailLoading.value = false
  }
}

const closeDetail = () => {
  detailOpen.value = false
  detailError.value = ''
  detailItem.value = null
  detailImages.value = []
  activeImageIndex.value = 0
}

const nextImage = () => {
  if (detailImages.value.length < 2) return
  activeImageIndex.value = (activeImageIndex.value + 1) % detailImages.value.length
}

const prevImage = () => {
  if (detailImages.value.length < 2) return
  activeImageIndex.value = (activeImageIndex.value - 1 + detailImages.value.length) % detailImages.value.length
}

const onWindowKeydown = (event) => {
  if (event.key === 'Escape' && detailOpen.value) closeDetail()
  if (event.key === 'ArrowLeft' && detailOpen.value) prevImage()
  if (event.key === 'ArrowRight' && detailOpen.value) nextImage()
}

const loadProfile = async () => {
  loading.value = true
  error.value = ''
  try {
    await authStore.fetchCurrentUser()
    const data = await filterItemsApi({ pageNo: 1, pageSize: 100 })
    const records = Array.isArray(data?.records) ? data.records : []
    const id = authStore.user?.id
    myPosts.value = records.filter((x) => x.userId === id || x.publisher?.id === id)
    await attachPostCoverImages(myPosts.value)
    postCount.value = myPosts.value.length
  } catch (e) {
    error.value = e?.message || '加载个人中心失败'
  } finally {
    loading.value = false
  }
}

const postTypeLabel = (type) => {
  if (type === 1) return '招领'
  if (type === 0) return '失物'
  if (type === 2) return '卡证'
  return '未知'
}

onMounted(async () => {
  window.addEventListener('keydown', onWindowKeydown)
  await loadProfile()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <AppShell>
    <section class="profile">
      <header class="profile-head">
        <div>
          <p class="kicker">个人中心</p>
          <h2>欢迎回来</h2>
          <p class="sub">查看你的资料与发布统计</p>
        </div>
        <button type="button" class="refresh-btn" @click="loadProfile">刷新</button>
      </header>

      <p v-if="loading" class="muted">正在加载...</p>
      <p v-else-if="error" class="error">{{ error }}</p>

      <div v-else class="profile-grid">
        <section class="card">
          <h3>基础资料</h3>
          <dl>
            <div>
              <dt>昵称</dt>
              <dd>{{ nickname }}</dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>{{ email }}</dd>
            </div>
          </dl>
        </section>
        <section class="card">
          <h3>发布概览</h3>
          <div class="stats">
            <div class="stat-block total">
              <p class="stat-label">总数</p>
              <p class="stat">{{ postCount }}</p>
            </div>
            <div class="stat-block found">
              <p class="stat-label">招领</p>
              <p class="stat">{{ foundCount }}</p>
            </div>
            <div class="stat-block lost">
              <p class="stat-label">失物</p>
              <p class="stat">{{ lostCount }}</p>
            </div>
            <div class="stat-block card-item">
              <p class="stat-label">卡证</p>
              <p class="stat">{{ cardCount }}</p>
            </div>
          </div>
        </section>
        <section class="card">
          <h3>账号状态</h3>
          <p class="status">已登录，资料同步正常</p>
          <p class="stat-hint">如有异常请刷新或重新登录</p>
        </section>
      </div>

      <section v-if="!loading && !error" class="post-panel">
        <div class="post-head">
          <h3>我的发帖</h3>
          <p>共 {{ filteredPosts.length }} / {{ postCount }} 条</p>
        </div>
        <div class="post-type-segmented" role="group" aria-label="我的帖子分类">
          <button
            v-for="opt in postTypeOptions"
            :key="`profile-type-${opt.value}`"
            type="button"
            class="post-type-btn"
            :class="{ active: selectedPostType === opt.value }"
            @click="selectedPostType = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <p v-if="!myPosts.length" class="muted">暂时还没有发布记录</p>
        <p v-else-if="!filteredPosts.length" class="muted">当前分类暂无记录</p>

        <div v-else class="post-grid">
          <button
            v-for="item in filteredPosts"
            :key="item.id"
            class="post-card"
            type="button"
            @click="openDetail(item.id)"
          >
            <div
              class="post-cover"
              :class="{ 'has-cover': item.coverUrl }"
              :style="item.coverUrl ? { backgroundImage: `url('${item.coverUrl}')` } : {}"
            ></div>
            <div class="post-body">
              <p class="post-title">{{ item.description || '无标题物品' }}</p>
              <p class="post-meta">{{ postTypeLabel(item.type) }} · {{ item.eventPlace || '地点未填写' }}</p>
              <p class="post-time">{{ formatDate(item.createdAt || item.eventTime) }}</p>
            </div>
          </button>
        </div>
      </section>
    </section>

    <Teleport to="body">
      <div v-if="detailOpen" class="detail-overlay" @click.self="closeDetail">
        <section class="detail-modal">
          <header class="drawer-head">
            <h4>物品详情</h4>
            <button class="close-btn" type="button" aria-label="关闭" @click="closeDetail">&times;</button>
          </header>

          <div class="detail-content">
            <aside class="detail-left">
              <div v-if="detailLoading" class="media-placeholder" role="status" aria-live="polite">正在加载...</div>
              <div v-else-if="detailError" class="media-placeholder error" role="alert" aria-live="polite">{{ detailError }}</div>
              <template v-else>
                <div class="carousel">
                  <button v-if="detailImages.length > 1" class="nav prev" type="button" aria-label="上一张" @click="prevImage">
                    &#8249;
                  </button>
                  <img
                    v-if="activeImageUrl"
                    :src="activeImageUrl"
                    class="carousel-image"
                    alt="物品图片"
                    width="600"
                    height="800"
                  />
                  <div v-else class="media-placeholder">暂无图片</div>
                  <button v-if="detailImages.length > 1" class="nav next" type="button" aria-label="下一张" @click="nextImage">
                    &#8250;
                  </button>
                </div>
              </template>
            </aside>

            <div v-if="detailItem && !detailLoading && !detailError" class="detail-right">
              <p class="drawer-desc">{{ detailItem.description || '暂无描述' }}</p>
              <div v-if="Array.isArray(detailItem.tags) && detailItem.tags.length" class="detail-tags">
                <span v-for="tag in detailItem.tags" :key="`detail-tag-${tag}`" class="detail-tag">#{{ tag }}</span>
              </div>
              <dl class="detail-meta">
                <div>
                  <dt>发布者</dt>
                  <dd>{{ detailItem.publisher?.nickname || '-' }}</dd>
                </div>
                <div>
                  <dt>地点</dt>
                  <dd>{{ detailItem.eventPlace || '-' }}</dd>
                </div>
                <div>
                  <dt>发现时间</dt>
                  <dd>{{ formatDate(detailItem.eventTime) }}</dd>
                </div>
                <div>
                  <dt>发布时间</dt>
                  <dd>{{ formatDate(detailItem.createdAt) }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </AppShell>
</template>

<style scoped>
.profile {
  display: grid;
  gap: 1.2rem;
}

.profile-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 16px;
  border: 1.5px solid #d7dee8;
  background: #ffffff;
  box-shadow: 0 16px 30px rgba(24, 33, 64, 0.08);
}

.kicker {
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  color: var(--text-tertiary);
}

.profile-head h2 {
  margin: 0.35rem 0 0.25rem;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
}

.sub {
  margin: 0;
  color: var(--text-secondary);
}

.refresh-btn {
  border: none;
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  background: var(--accent);
  color: #ffffff;
  cursor: pointer;
  font-size: 0.85rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.refresh-btn:hover {
  background: var(--accent-hover);
}

.refresh-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.9rem;
}

.card {
  border: 1.5px solid #d7dee8;
  border-radius: 16px;
  padding: 1rem 1.1rem;
  background: #ffffff;
  box-shadow: 0 12px 24px rgba(24, 33, 64, 0.08);
  display: grid;
  gap: 0.7rem;
}

.card h3 {
  margin: 0;
  font-size: 1rem;
}

dl {
  display: grid;
  gap: 0.6rem;
  margin: 0;
}

dt {
  font-size: 0.78rem;
  color: var(--text-tertiary);
}

dd {
  margin: 0.1rem 0 0;
  color: var(--text-primary);
}

.stat {
  font-size: 2rem;
  margin: 0;
  font-weight: 700;
  line-height: 1.1;
}

.stat-hint {
  margin: 0;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.55rem;
  border: 1px solid #d5dfec;
  border-radius: 14px;
  background:
    radial-gradient(circle at 12% 18%, rgba(65, 124, 244, 0.12), transparent 54%),
    radial-gradient(circle at 88% 90%, rgba(53, 207, 181, 0.1), transparent 50%),
    #f5f9ff;
  padding: 0.55rem;
}

.stat-block {
  position: relative;
  overflow: hidden;
  padding: 0.75rem 0.8rem;
  display: grid;
  gap: 0.2rem;
  border: 1px solid #d7e2f1;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(2px);
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.stat-label {
  margin: 0 0 0.2rem;
  font-size: 0.74rem;
  color: #51627f;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.stat {
  position: relative;
  z-index: 1;
}

.stat-block::after {
  content: '';
  position: absolute;
  right: -18px;
  top: -16px;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  opacity: 0.25;
}

.stat-block.total::after {
  background: #3b82f6;
}

.stat-block.found::after {
  background: #0ea5a6;
}

.stat-block.lost::after {
  background: #f59e0b;
}

.stat-block.card-item::after {
  background: #2563eb;
}

.stat-block:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 22px rgba(29, 50, 92, 0.12);
}

.status {
  margin: 0;
  font-weight: 600;
}

.muted {
  color: var(--text-secondary);
}

.error {
  color: #b42318;
}

.post-panel {
  border: 1.5px solid #d7dee8;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 12px 24px rgba(24, 33, 64, 0.08);
  padding: 1rem 1.1rem;
  display: grid;
  gap: 0.9rem;
}

.post-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.post-head h3 {
  margin: 0;
  font-size: 1rem;
}

.post-head p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.post-type-segmented {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #d7dee8;
  border-radius: 999px;
  padding: 0.25rem;
  width: fit-content;
}

.post-type-btn {
  border: none;
  background: transparent;
  color: #334155;
  border-radius: 999px;
  padding: 0.38rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.post-type-btn:hover {
  background: #eef2f9;
}

.post-type-btn.active {
  background: #1d4ed8;
  color: #ffffff;
}

.post-type-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.22);
}

.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.8rem;
}

.post-card {
  text-decoration: none;
  color: inherit;
  border: 1px solid #d7dee8;
  border-radius: 14px;
  padding: 0.7rem;
  background: #ffffff;
  display: grid;
  gap: 0.55rem;
  box-shadow: 0 8px 20px rgba(24, 33, 64, 0.08);
  transition: transform 120ms ease, box-shadow 120ms ease;
  text-align: left;
  font: inherit;
  cursor: pointer;
  appearance: none;
}

.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px rgba(24, 33, 64, 0.18);
}

.post-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.post-title {
  margin: 0;
  font-weight: 600;
  color: var(--text-primary);
}

.post-body {
  display: grid;
  gap: 0.25rem;
}

.post-cover {
  width: 100%;
  border-radius: 10px;
  background: #e5eaf3;
  aspect-ratio: 3 / 4;
  background-size: cover;
  background-position: center;
}

.post-cover.has-cover {
  background-color: #d2d9e6;
}

.post-meta,
.post-time {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(12, 18, 33, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 80;
}

.detail-modal {
  width: min(980px, 100%);
  max-height: min(86vh, 760px);
  background: #ffffff;
  border-radius: 18px;
  padding: 1rem;
  overflow: auto;
  overscroll-behavior: contain;
  box-shadow: 0 20px 46px rgba(24, 33, 64, 0.2);
  border: 1.5px solid #d7dee8;
}

.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.2rem 0.2rem 0.6rem;
  border-bottom: 1px dashed #d7dee8;
}

.drawer-head h4 {
  font-size: 1.1rem;
}

.close-btn {
  border: none;
  border-radius: 999px;
  width: 2rem;
  height: 2rem;
  font-size: 1.4rem;
  line-height: 1;
  color: var(--text-primary);
  background: #eef2f7;
  cursor: pointer;
}

.close-btn:hover {
  background: #e3e9f2;
}

.close-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.detail-content {
  display: grid;
  grid-template-columns: minmax(320px, 1.05fr) minmax(320px, 1fr);
  gap: 0.9rem;
}

.detail-left,
.detail-right {
  min-width: 0;
}

.detail-right {
  border-left: 1px dashed #d7dee8;
  padding-left: 0.9rem;
}

.carousel {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: #e5eaf3;
  aspect-ratio: 3 / 4;
}

.carousel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-placeholder {
  width: 100%;
  min-height: 11rem;
  border-radius: 16px;
  background: #eef2f7;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  text-align: center;
  padding: 0.8rem;
}

.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  font-size: 1.3rem;
}

.nav:hover {
  background: #ffffff;
}

.nav:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.nav.prev {
  left: 0.6rem;
}

.nav.next {
  right: 0.6rem;
}

.drawer-desc {
  line-height: 1.7;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.detail-tags {
  margin-top: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.detail-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.58rem;
  border-radius: 999px;
  border: 1px solid #ced7e6;
  background: #f7f9fd;
  color: #1a2a44;
  font-size: 0.74rem;
}

.detail-meta {
  margin-top: 0.9rem;
  display: grid;
  gap: 0.62rem;
}

.detail-meta dt {
  font-size: 0.78rem;
  color: var(--text-tertiary);
}

.detail-meta dd {
  margin-top: 0.12rem;
  color: var(--text-primary);
}

@media (max-width: 720px) {
  .profile-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats {
    grid-template-columns: 1fr;
  }

  .detail-content {
    grid-template-columns: 1fr;
  }

  .detail-right {
    border-left: none;
    border-top: 1px solid #e5eaf2;
    padding-left: 0;
    padding-top: 0.9rem;
  }
}
</style>
