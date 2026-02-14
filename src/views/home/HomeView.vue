<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppShell from '../../layouts/AppShell.vue'
import BaseButton from '../../components/base/BaseButton.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import { filterItemsApi, getItemDetailByIdApi, recognizeImageTagsApi } from '../../services/item.api'

const TXT = {
  foundTitle: '招领广场',
  foundSubtitle: '从招领开始，你要找的东西',
  lostTitle: '失物广场',
  lostSubtitle: '从挂失开始，你要找的东西',
  searchPlaceholder: '搜索关键词 / 地点… 例：雨伞',
  searchLabel: '搜索',
  typeFound: '招领',
  typeLost: '挂失',
  timeAll: '全部时间',
  timeDay: '最近24小时',
  timeWeek: '最近7天',
  imageSearch: '图搜',
  imageOnlyOn: '图片流',
  imageOnlyOff: '图文流',
  refresh: '刷新',
  imageHint: '识别标签已用于筛选',
  loading: '正在加载…',
  empty: '暂无内容',
  error: '加载失败，请稍后再试',
  unknown: '暂无描述',
  place: '地点',
  eventTime: '发现时间',
  publishTime: '发布时间',
  publisher: '发布者',
  noImage: '暂无图片',
  detailTitle: '物品详情',
  loadMore: '加载更多',
}

const typeOptions = [
  { label: TXT.typeFound, value: 1 },
  { label: TXT.typeLost, value: 0 },
]

const timeOptions = [
  { label: TXT.timeAll, value: 'all' },
  { label: TXT.timeDay, value: 'day' },
  { label: TXT.timeWeek, value: 'week' },
]

const selectedType = ref(1)
const selectedTime = ref('all')
const searchText = ref('')
const recognizedTags = ref([])
const loading = ref(false)
const error = ref('')
const items = ref([])
const pageNo = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const imageOnly = ref(false)

const heroTitle = computed(() => (selectedType.value === 1 ? TXT.foundTitle : TXT.lostTitle))
const heroSubtitle = computed(() => (selectedType.value === 1 ? TXT.foundSubtitle : TXT.lostSubtitle))

const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailItem = ref(null)
const detailImages = ref([])
const activeImageIndex = ref(0)
const imageInputRef = ref(null)

const activeImageUrl = computed(() => detailImages.value[activeImageIndex.value] || '')

const isRenderableImageUrl = (value) => {
  if (typeof value !== 'string') return false
  const url = value.trim().toLowerCase()
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/dev-local-images/')
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

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getTimeRange = () => {
  if (selectedTime.value === 'day') {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
  if (selectedTime.value === 'week') {
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
  return null
}

const applyLocalSearch = (records) => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return records
  return records.filter((item) => {
    const desc = (item?.description || '').toLowerCase()
    const place = (item?.eventPlace || '').toLowerCase()
    return desc.includes(keyword) || place.includes(keyword)
  })
}

const fetchItems = async (reset = false) => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    if (reset) {
      pageNo.value = 1
      hasMore.value = true
      items.value = []
    }

    const payload = {
      pageNo: pageNo.value,
      pageSize: 20,
      type: selectedType.value,
    }
    const startTime = getTimeRange()
    if (startTime) payload.startTime = startTime
    if (recognizedTags.value.length) payload.tags = recognizedTags.value

    const result = await filterItemsApi(payload)
    const records = Array.isArray(result?.records) ? result.records : []
    const filtered = applyLocalSearch(records)
    if (pageNo.value === 1) {
      items.value = filtered
    } else {
      items.value = [...items.value, ...filtered]
    }

    hasMore.value = records.length === payload.pageSize
    if (hasMore.value) pageNo.value += 1

    await attachCoverImages(filtered)
  } catch (err) {
    error.value = err?.message || TXT.error
  } finally {
    loading.value = false
  }
}

const refreshItems = async () => {
  await fetchItems(true)
}

const attachCoverImages = async (records) => {
  if (!Array.isArray(records) || !records.length) return
  await Promise.all(
    records.map(async (item) => {
      if (!item?.id || item.coverUrl) return
      try {
        const detail = await getItemDetailByIdApi(item.id)
        const firstUrl = Array.isArray(detail?.imageUrls) ? detail.imageUrls[0] : ''
        const normalized = normalizeDetailImageUrl(firstUrl)
        if (normalized) {
          item.coverUrl = normalized
        }
        if (detail?.publisher) {
          item.publisher = detail.publisher
        }
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
    detailImages.value = Array.isArray(item?.imageUrls)
      ? item.imageUrls.map(normalizeDetailImageUrl).filter(isRenderableImageUrl)
      : []
  } catch (error) {
    detailError.value = error?.message || TXT.error
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

const triggerImageSearch = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  try {
    const tags = await recognizeImageTagsApi(file)
    recognizedTags.value = Array.isArray(tags) ? tags.slice(0, 6) : []
    await fetchItems(true)
  } catch {
    // ignore
  }
}

const openImagePicker = () => {
  if (imageInputRef.value) imageInputRef.value.click()
}

let searchTimer
watch([selectedType, selectedTime], () => fetchItems(true))
watch(searchText, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchItems(true), 350)
})

onMounted(async () => {
  window.addEventListener('keydown', onWindowKeydown)
  await fetchItems(true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <AppShell>
    <section class="home">
      <header class="hero">
        <div class="hero-title">
          <h2>{{ heroTitle }}</h2>
          <p class="hint">{{ heroSubtitle }}</p>
        </div>
        <div class="hero-tools">
          <input
            v-model="searchText"
            class="search"
            type="search"
            name="search"
            autocomplete="off"
            autocapitalize="none"
            :aria-label="TXT.searchLabel"
            :placeholder="TXT.searchPlaceholder"
          />
          <div class="controls">
            <div class="segmented">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                type="button"
                class="seg-btn"
                :class="{ active: selectedType === opt.value }"
                @click="selectedType = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <div class="select-wrap">
              <select v-model="selectedTime" class="time-select" name="timeRange" aria-label="时间范围">
                <option v-for="opt in timeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <span class="select-caret"></span>
            </div>
            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="hidden-input"
              aria-label="图片搜索"
              @change="triggerImageSearch"
            />
            <button class="image-search" type="button" @click="openImagePicker">
              {{ TXT.imageSearch }}
            </button>
          </div>
          <p v-if="recognizedTags.length" class="tag-hint">
            {{ TXT.imageHint }}：
            <span v-for="tag in recognizedTags" :key="`tag-${tag}`">#{{ tag }}</span>
          </p>
        </div>
      </header>

      <SoftPanel class="grid-shell">
        <p v-if="loading" class="muted" role="status" aria-live="polite">{{ TXT.loading }}</p>
        <p v-else-if="error" class="error" role="alert" aria-live="polite">{{ error }}</p>
        <p v-else-if="!items.length" class="muted" role="status" aria-live="polite">{{ TXT.empty }}</p>

        <div v-else class="card-grid" :class="{ 'image-only': imageOnly }">
          <button
            v-for="item in items"
            :key="item.id"
            class="card"
            type="button"
            @click="openDetail(item.id)"
          >
            <div
              class="cover"
              :class="{ 'has-cover': item.coverUrl }"
              :style="item.coverUrl ? { backgroundImage: `url('${item.coverUrl}')` } : {}"
            ></div>
            <div v-if="!imageOnly" class="card-body">
              <p class="desc">{{ item.description || TXT.unknown }}</p>
              <div class="meta">
                <span>{{ TXT.place }}：{{ item.eventPlace || '-' }}</span>
                <span>{{ TXT.eventTime }}：{{ formatDateTime(item.eventTime) }}</span>
              </div>
              <p class="publisher">{{ TXT.publisher }}：{{ item.publisher?.nickname || '-' }}</p>
            </div>
          </button>
        </div>

        <div v-if="hasMore && !loading" class="more">
          <BaseButton variant="ghost" :loading="loadingMore" @click="fetchItems()">
            {{ TXT.loadMore }}
          </BaseButton>
        </div>
      </SoftPanel>
    </section>
    <div class="fab-stack">
      <button
        type="button"
        class="fab-btn"
        :class="{ active: imageOnly }"
        :aria-label="imageOnly ? TXT.imageOnlyOff : TXT.imageOnlyOn"
        :title="imageOnly ? TXT.imageOnlyOff : TXT.imageOnlyOn"
        @click="imageOnly = !imageOnly"
      >
        <span class="fab-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="9" r="2.2"></circle>
            <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm2.5-.5a.5.5 0 0 0-.5.5v10.6l4.1-4.2a1.3 1.3 0 0 1 1.9 0l3.2 3.3 2.2-2.2a1.3 1.3 0 0 1 1.9 0l1.7 1.8V6.5a.5.5 0 0 0-.5-.5h-11Z"></path>
          </svg>
        </span>
      </button>
      <button type="button" class="fab-btn" :aria-label="TXT.refresh" :title="TXT.refresh" @click="refreshItems">
        <span class="fab-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M20 12a8 8 0 1 1-2.35-5.65"></path>
            <path d="M20 5v5h-5"></path>
          </svg>
        </span>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="detailOpen" class="detail-overlay" @click.self="closeDetail">
        <section class="detail-modal">
          <header class="drawer-head">
            <h4>{{ TXT.detailTitle }}</h4>
            <button class="close-btn" type="button" aria-label="关闭" @click="closeDetail">&times;</button>
          </header>

          <div class="detail-content">
            <aside class="detail-left">
              <div v-if="detailLoading" class="media-placeholder" role="status" aria-live="polite">{{ TXT.loading }}</div>
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
                  <div v-else class="media-placeholder">{{ TXT.noImage }}</div>
                  <button v-if="detailImages.length > 1" class="nav next" type="button" aria-label="下一张" @click="nextImage">
                    &#8250;
                  </button>
                </div>
              </template>
            </aside>

            <div v-if="detailItem && !detailLoading && !detailError" class="detail-right">
              <p class="drawer-desc">{{ detailItem.description || TXT.unknown }}</p>
              <dl class="detail-meta">
                <div>
                  <dt>{{ TXT.publisher }}</dt>
                  <dd>{{ detailItem.publisher?.nickname || '-' }}</dd>
                </div>
                <div>
                  <dt>{{ TXT.place }}</dt>
                  <dd>{{ detailItem.eventPlace || '-' }}</dd>
                </div>
                <div>
                  <dt>{{ TXT.eventTime }}</dt>
                  <dd>{{ formatDateTime(detailItem.eventTime) }}</dd>
                </div>
                <div>
                  <dt>{{ TXT.publishTime }}</dt>
                  <dd>{{ formatDateTime(detailItem.createdAt) }}</dd>
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
.home {
  display: grid;
  gap: 1.8rem;
}

.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.6rem;
  align-items: stretch;
}

.hero-kicker {
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: none;
  color: var(--text-tertiary);
}

.hero-title h2 {
  font-size: clamp(2.2rem, 4vw, 3rem);
  margin: 0.35rem 0 0.5rem;
  letter-spacing: 0.03em;
  text-transform: none;
}

.hint {
  color: var(--text-secondary);
  font-size: 1rem;
  max-width: 36ch;
}

.hero-tools {
  padding: 1.25rem 1.25rem 1.4rem;
  border-radius: 16px;
  border: 1.5px solid #d7dee8;
  background: #ffffff;
  box-shadow: 0 16px 32px rgba(24, 33, 64, 0.1);
  display: grid;
  gap: 0.85rem;
  position: relative;
}

.search {
  border-radius: 999px;
  border: 1px solid #d7dee8;
  padding: 0.64rem 1rem;
  font-size: 0.95rem;
  background: #f7f9fc;
}

.search:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.controls {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.7rem;
  align-items: center;
}

.segmented {
  display: flex;
  background: #eef2f7;
  border-radius: 999px;
  padding: 0.25rem;
  border: 1px solid #d7dee8;
}

.seg-btn {
  border: none;
  background: transparent;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.seg-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.seg-btn:hover {
  background: #e2e8f2;
  color: var(--text-primary);
}

.seg-btn.active {
  background: #111827;
  color: #ffffff;
}

.select-wrap {
  position: relative;
}

.time-select {
  width: 100%;
  appearance: none;
  border-radius: 999px;
  border: 1px solid #d7dee8;
  padding: 0.52rem 2.2rem 0.52rem 0.9rem;
  font-size: 0.84rem;
  background: #f7f9fc;
  color: var(--text-primary);
}

.time-select:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.select-caret {
  position: absolute;
  right: 0.8rem;
  top: 50%;
  transform: translateY(-50%);
  width: 0.45rem;
  height: 0.45rem;
  border-right: 2px solid var(--text-secondary);
  border-bottom: 2px solid var(--text-secondary);
  transform: translateY(-60%) rotate(45deg);
  pointer-events: none;
}

.image-search {
  border-radius: 999px;
  padding: 0.55rem 1rem;
  border: none;
  background: var(--accent);
  color: #ffffff;
  cursor: pointer;
  font-size: 0.82rem;
  letter-spacing: 0.02em;
  text-transform: none;
  text-align: center;
  white-space: nowrap;
}

.image-search:focus-visible {
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.image-search:hover {
  background: var(--accent-hover);
}

.hidden-input {
  display: none;
}

.tag-hint {
  font-size: 0.82rem;
  color: var(--accent-alt);
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.grid-shell {
  padding: 1.1rem;
  background: #ffffff;
  border-radius: 18px;
  border: 1.5px solid #d7dee8;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 0.8rem;
}

.card-grid.image-only {
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.6rem;
}

.card-grid.image-only .card {
  padding: 0.4rem;
}

.card-grid.image-only .cover {
  border-radius: 10px;
  aspect-ratio: 4 / 5;
}

.card {
  display: block;
  width: 100%;
  padding: 0.7rem;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid #d7dee8;
  box-shadow: 0 8px 20px rgba(24, 33, 64, 0.08);
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  text-align: left;
  font: inherit;
  color: inherit;
  appearance: none;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px rgba(24, 33, 64, 0.18);
}

.cover {
  width: 100%;
  border-radius: 10px;
  background: #e5eaf3;
  aspect-ratio: 3 / 4;
  background-size: cover;
  background-position: center;
}

.cover.has-cover {
  background-color: #d2d9e6;
}

.card-body {
  margin-top: 0.55rem;
}

.desc {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.meta {
  margin-top: 0.35rem;
  display: grid;
  gap: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.74rem;
}

.publisher {
  margin-top: 0.4rem;
  color: var(--text-secondary);
  font-size: 0.74rem;
}

.more {
  display: flex;
  justify-content: center;
  margin-top: 1.2rem;
}

.muted {
  color: #64748b;
}

.error {
  color: #b91c1c;
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
  letter-spacing: 0.06em;
  text-transform: none;
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

.detail-left {
  min-width: 0;
}

.detail-right {
  min-width: 0;
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

@media (max-width: 960px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .controls {
    grid-template-columns: 1fr;
  }

  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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

@media (max-width: 640px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}

.fab-stack {
  position: fixed;
  right: 1.6rem;
  bottom: 1.6rem;
  display: grid;
  gap: 0.6rem;
  z-index: 60;
}

.fab-btn {
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 999px;
  border: 2px solid #d7dee8;
  background: #ffffff;
  color: var(--text-primary);
  box-shadow: 0 16px 32px rgba(24, 33, 64, 0.2);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.fab-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--focus-ring);
}

.fab-btn.active {
  background: var(--accent);
  color: #ffffff;
  border-color: var(--accent);
}

.fab-icon {
  width: 1.2rem;
  height: 1.2rem;
  display: grid;
  place-items: center;
}

.fab-icon svg {
  width: 1.2rem;
  height: 1.2rem;
}

.fab-btn:hover {
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none;
  }

  .card:hover {
    transform: none;
  }

  .fab-btn:hover {
    transform: none;
  }
}

</style>
