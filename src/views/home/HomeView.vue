<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppShell from '../../layouts/AppShell.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import TagFilterSidebar from '../../components/home/TagFilterSidebar.vue'
import { filterItemsApi, getItemDetailByIdApi, recognizeImageTagsApi } from '../../services/item.api'
import { listTagsApi } from '../../services/tag.api'

const TXT = {
  foundTitle: '招领广场',
  foundSubtitle: '从招领开始，你要找的东西',
  lostTitle: '失物广场',
  lostSubtitle: '从挂失开始，你要找的东西',
  cardTitle: '卡证专区',
  cardSubtitle: '聚焦证件、号卡等带唯一编号的物品',
  cardSearchPlaceholder: '输入唯一编号/身份证号/学号/卡号',
  searchPlaceholder: '搜索关键词 / 地点… 例：雨伞',
  searchLabel: '搜索',
  typeFound: '招领',
  typeLost: '挂失',
  typeCard: '卡证',
  timeAll: '全部时间',
  timeDay: '最近24小时',
  timeWeek: '最近7天',
  imageSearch: '图搜',
  imageOnlyOn: '图片流',
  imageOnlyOff: '图文流',
  refresh: '刷新',
  imageHint: '识别标签已加入待应用',
  loading: '正在加载…',
  empty: '暂无内容',
  cardEmpty: '卡证模式下不会主动展示物品，请先输入编号信息再检索。',
  error: '加载失败，请稍后再试',
  unknown: '暂无描述',
  place: '地点',
  eventTime: '发现时间',
  publishTime: '发布时间',
  publisher: '发布者',
  noImage: '暂无图片',
  detailTitle: '物品详情',
  prevPage: '上一页',
  nextPage: '下一页',
  pageSize: '每页',
}

const typeOptions = [
  { label: TXT.typeFound, value: 1, hint: '接下来的搜索和筛选都只针对招领。' },
  { label: TXT.typeLost, value: 0, hint: '接下来的搜索和筛选都只针对挂失。' },
  { label: TXT.typeCard, value: 'card', hint: '接下来的搜索和筛选都只针对证件、号卡等带有唯一编号的物品。' },
]

const timeOptions = [
  { label: TXT.timeAll, value: 'all' },
  { label: TXT.timeDay, value: 'day' },
  { label: TXT.timeWeek, value: 'week' },
]

const TOKEN_KEY = 'laf_token'
const router = useRouter()

const selectedType = ref(1)
const selectedTime = ref('all')
const searchText = ref('')
const recognizedTags = ref([])
const sidebarCollapsed = ref(true)
const tagSearchText = ref('')
const tagOptions = ref([])
const tagPageNo = ref(1)
const tagPageSize = ref(20)
const tagTotal = ref(0)
const tagLoading = ref(false)
const pendingTags = ref([])
const appliedTags = ref([])
const pendingPreciseTagMatch = ref(false)
const appliedPreciseTagMatch = ref(false)
const loading = ref(false)
const error = ref('')
const items = ref([])
const pageNo = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const imageOnly = ref(false)

const heroTitle = computed(() => {
  if (selectedType.value === 1) return TXT.foundTitle
  if (selectedType.value === 0) return TXT.lostTitle
  return TXT.cardTitle
})
const heroSubtitle = computed(() => {
  if (selectedType.value === 1) return TXT.foundSubtitle
  if (selectedType.value === 0) return TXT.lostSubtitle
  return TXT.cardSubtitle
})
const searchPlaceholder = computed(() =>
  selectedType.value === 'card' ? TXT.cardSearchPlaceholder : TXT.searchPlaceholder,
)
const emptyMessage = computed(() => {
  if (selectedType.value === 'card' && !searchText.value.trim()) return TXT.cardEmpty
  return TXT.empty
})
const itemPageCount = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))
const canPrevItemPage = computed(() => pageNo.value > 1)
const canNextItemPage = computed(() => pageNo.value < itemPageCount.value)
const CARD_VIRTUAL_THRESHOLD = 50
const CARD_OVERSCAN_ROWS = 2
const cardViewportRef = ref(null)
const cardScrollTop = ref(0)
const cardViewportWidth = ref(0)
const cardViewportHeight = ref(620)
let cardViewportResizeObserver = null
const isCardVirtualized = computed(() => items.value.length > CARD_VIRTUAL_THRESHOLD || pageSize.value > CARD_VIRTUAL_THRESHOLD)
const cardColumnGapPx = computed(() => (imageOnly.value ? 10 : 13))
const cardColumns = computed(() => {
  const width = cardViewportWidth.value || 0
  if (width <= 640) return 1
  const minWidth = imageOnly.value ? 170 : width <= 960 ? 200 : 230
  return Math.max(1, Math.floor((width + cardColumnGapPx.value) / (minWidth + cardColumnGapPx.value)))
})
const cardRowSize = computed(() => (imageOnly.value ? 292 : 402))
const cardRows = computed(() => {
  const rows = []
  const cols = Math.max(1, cardColumns.value)
  for (let i = 0; i < items.value.length; i += cols) {
    rows.push({
      rowIndex: Math.floor(i / cols),
      items: items.value.slice(i, i + cols),
    })
  }
  return rows
})
const cardVisibleStartRow = computed(() =>
  Math.max(0, Math.floor(cardScrollTop.value / cardRowSize.value) - CARD_OVERSCAN_ROWS),
)
const cardVisibleRowCount = computed(
  () => Math.ceil(cardViewportHeight.value / cardRowSize.value) + CARD_OVERSCAN_ROWS * 2,
)
const visibleCardRows = computed(() =>
  cardRows.value.slice(cardVisibleStartRow.value, cardVisibleStartRow.value + cardVisibleRowCount.value),
)
const cardVirtualOffset = computed(() => cardVisibleStartRow.value * cardRowSize.value)
const cardVirtualTotalHeight = computed(() => cardRows.value.length * cardRowSize.value)

const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailItem = ref(null)
const detailImages = ref([])
const activeImageIndex = ref(0)
const imageInputRef = ref(null)

const activeImageUrl = computed(() => detailImages.value[activeImageIndex.value] || '')

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

const hasValidSession = () => isTokenValid(sessionStorage.getItem(TOKEN_KEY))

const redirectToLogin = () => {
  router.push({ name: 'login', query: { redirect: '/home' } })
}

const requireLoginForAction = () => {
  if (hasValidSession()) return true
  redirectToLogin()
  return false
}

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
  if (selectedType.value === 'card') {
    return records
  }
  let scoped = records
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return scoped
  return scoped.filter((item) => {
    const desc = (item?.description || '').toLowerCase()
    const place = (item?.eventPlace || '').toLowerCase()
    return desc.includes(keyword) || place.includes(keyword)
  })
}

const fetchItems = async (reset = false) => {
  if (!hasValidSession()) {
    if (reset) {
      items.value = []
      totalItems.value = 0
      pageNo.value = 1
    }
    return
  }
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    if (reset) {
      pageNo.value = 1
      items.value = []
      totalItems.value = 0
    }

    const payload = {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    }
    if (selectedType.value === 'card' && !searchText.value.trim()) {
      items.value = []
      totalItems.value = 0
      return
    }
    if (selectedType.value === 0 || selectedType.value === 1) {
      payload.type = selectedType.value
    }
    if (selectedType.value === 'card') {
      payload.type = 2
      const cardKeyword = searchText.value.trim()
      if (cardKeyword) {
        payload.tags = [`priv:no=${cardKeyword}`]
        payload.preciseTagMatch = false
      }
    }
    const startTime = getTimeRange()
    if (startTime) payload.startTime = startTime
    if (appliedTags.value.length && selectedType.value !== 'card') {
      payload.tags = appliedTags.value
      payload.preciseTagMatch = appliedPreciseTagMatch.value
    }

    const result = await filterItemsApi(payload)
    const records = Array.isArray(result?.records) ? result.records : []
    const filtered = applyLocalSearch(records)
    items.value = filtered
    totalItems.value = Number(result?.total || 0)

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
  if (!requireLoginForAction()) return
  try {
    const tags = await recognizeImageTagsApi(file)
    recognizedTags.value = Array.isArray(tags) ? tags.slice(0, 6) : []
    const merged = [...pendingTags.value]
    for (const tag of recognizedTags.value) {
      if (tag && !merged.includes(tag)) merged.push(tag)
    }
    pendingTags.value = merged
    sidebarCollapsed.value = false
  } catch {
    // ignore
  }
}

const openImagePicker = () => {
  if (imageInputRef.value) imageInputRef.value.click()
}

const fetchTagOptions = async () => {
  if (!hasValidSession()) {
    tagOptions.value = []
    tagTotal.value = 0
    return
  }
  tagLoading.value = true
  try {
    const result = await listTagsApi({
      q: tagSearchText.value.trim() || undefined,
      pageNo: tagPageNo.value,
      pageSize: tagPageSize.value,
    })
    tagOptions.value = Array.isArray(result?.records) ? result.records : []
    tagTotal.value = Number(result?.total || 0)
  } catch {
    tagOptions.value = []
    tagTotal.value = 0
  } finally {
    tagLoading.value = false
  }
}

const toggleTagSidebar = () => {
  if (!requireLoginForAction()) return
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const handleTagSearchChange = (value) => {
  if (!requireLoginForAction()) return
  tagSearchText.value = value
}

const togglePendingTag = (tagName) => {
  if (!requireLoginForAction()) return
  if (!tagName) return
  if (pendingTags.value.includes(tagName)) {
    pendingTags.value = pendingTags.value.filter((name) => name !== tagName)
    return
  }
  pendingTags.value = [...pendingTags.value, tagName]
}

const removePendingTag = (tagName) => {
  if (!requireLoginForAction()) return
  pendingTags.value = pendingTags.value.filter((name) => name !== tagName)
}

const clearPendingTags = () => {
  if (!requireLoginForAction()) return
  pendingTags.value = []
}

const changeTagPage = (nextPage) => {
  if (!requireLoginForAction()) return
  tagPageNo.value = nextPage
}

const changeTagPageSize = (nextPageSize) => {
  if (!requireLoginForAction()) return
  tagPageSize.value = Number(nextPageSize) || 20
  tagPageNo.value = 1
}

const applyPendingTags = async () => {
  if (!requireLoginForAction()) return
  appliedTags.value = [...pendingTags.value]
  appliedPreciseTagMatch.value = pendingPreciseTagMatch.value
  pageNo.value = 1
  await fetchItems(true)
}

const handleSearchFocus = () => {
  if (!hasValidSession()) redirectToLogin()
}

const handleTypeChange = (value) => {
  if (!requireLoginForAction()) return
  selectedType.value = value
}

const handleTimeChange = (event) => {
  if (!requireLoginForAction()) {
    event.target.value = selectedTime.value
    return
  }
  selectedTime.value = event.target.value
}

const handleOpenImagePicker = () => {
  if (!requireLoginForAction()) return
  openImagePicker()
}

const handleCardClick = (itemId) => {
  if (!requireLoginForAction()) return
  openDetail(itemId)
}

const handleItemPrevPage = () => {
  if (!requireLoginForAction() || !canPrevItemPage.value) return
  pageNo.value -= 1
  fetchItems()
}

const handleItemNextPage = () => {
  if (!requireLoginForAction() || !canNextItemPage.value) return
  pageNo.value += 1
  fetchItems()
}

const handleItemPageSizeChange = (event) => {
  if (!requireLoginForAction()) return
  pageSize.value = Number(event.target.value) || 20
  pageNo.value = 1
  fetchItems()
}

const handleToggleImageOnly = () => {
  if (!requireLoginForAction()) return
  imageOnly.value = !imageOnly.value
}

const handleRefreshItems = () => {
  if (!requireLoginForAction()) return
  refreshItems()
}

const updateCardViewportMetrics = () => {
  const el = cardViewportRef.value
  if (!el) return
  cardViewportWidth.value = el.clientWidth || 0
  cardViewportHeight.value = el.clientHeight || 620
}

const onCardViewportScroll = (event) => {
  cardScrollTop.value = event.target?.scrollTop || 0
}

const resetCardVirtualScroll = () => {
  cardScrollTop.value = 0
  if (cardViewportRef.value) {
    cardViewportRef.value.scrollTop = 0
  }
}

const bindCardViewportObserver = () => {
  if (cardViewportResizeObserver) {
    cardViewportResizeObserver.disconnect()
    cardViewportResizeObserver = null
  }
  if (!isCardVirtualized.value || typeof ResizeObserver !== 'function' || !cardViewportRef.value) return
  cardViewportResizeObserver = new ResizeObserver(() => updateCardViewportMetrics())
  cardViewportResizeObserver.observe(cardViewportRef.value)
}

let searchTimer
let tagSearchTimer
watch([selectedType, selectedTime], () => fetchItems(true))
watch(searchText, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pageNo.value = 1
    fetchItems(true)
  }, 350)
})
watch(tagSearchText, () => {
  clearTimeout(tagSearchTimer)
  tagPageNo.value = 1
  tagSearchTimer = setTimeout(() => fetchTagOptions(), 300)
})
watch([tagPageNo, tagPageSize], () => {
  fetchTagOptions()
})
watch([items, pageSize, imageOnly], async () => {
  await nextTick()
  resetCardVirtualScroll()
  updateCardViewportMetrics()
  bindCardViewportObserver()
})
watch(
  isCardVirtualized,
  async () => {
    await nextTick()
    resetCardVirtualScroll()
    updateCardViewportMetrics()
    bindCardViewportObserver()
  },
  { immediate: true },
)

onMounted(async () => {
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('resize', updateCardViewportMetrics)
  await nextTick()
  bindCardViewportObserver()
  if (hasValidSession()) {
    await fetchTagOptions()
    await fetchItems(true)
  }
  updateCardViewportMetrics()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('resize', updateCardViewportMetrics)
  if (cardViewportResizeObserver) {
    cardViewportResizeObserver.disconnect()
    cardViewportResizeObserver = null
  }
  clearTimeout(searchTimer)
  clearTimeout(tagSearchTimer)
})
</script>

<template>
  <AppShell>
    <div class="home-layout">
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
            :placeholder="searchPlaceholder"
            @focus="handleSearchFocus"
          />
          <div class="controls">
            <div class="segmented">
              <button
                v-for="opt in typeOptions"
                :key="opt.value"
                type="button"
                class="seg-btn"
                :class="{ active: selectedType === opt.value }"
                :title="opt.hint"
                @click="handleTypeChange(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
            <div class="select-wrap">
              <select
                :value="selectedTime"
                class="time-select"
                name="timeRange"
                aria-label="时间范围"
                @change="handleTimeChange"
              >
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
            <button class="image-search" type="button" @click="handleOpenImagePicker">
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
          <p v-else-if="!items.length" class="muted" role="status" aria-live="polite">{{ emptyMessage }}</p>

          <div v-else-if="!isCardVirtualized" class="card-grid" :class="{ 'image-only': imageOnly }">
            <button
              v-for="item in items"
              :key="item.id"
              class="card"
              type="button"
              @click="handleCardClick(item.id)"
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

          <div v-else ref="cardViewportRef" class="card-viewport" @scroll="onCardViewportScroll">
            <div class="card-virtual-space" :style="{ height: `${cardVirtualTotalHeight}px` }">
              <div class="card-virtual-content" :class="{ 'image-only': imageOnly }" :style="{ transform: `translateY(${cardVirtualOffset}px)` }">
                <div
                  v-for="row in visibleCardRows"
                  :key="`card-row-${row.rowIndex}`"
                  class="card-row"
                  :class="{ 'image-only': imageOnly }"
                  :style="{ gridTemplateColumns: `repeat(${cardColumns}, minmax(0, 1fr))` }"
                >
                  <button
                    v-for="item in row.items"
                    :key="item.id"
                    class="card"
                    type="button"
                    @click="handleCardClick(item.id)"
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
              </div>
            </div>
          </div>

          <div v-if="!loading && !error && totalItems > 0" class="pager">
            <button class="pager-btn" type="button" :disabled="!canPrevItemPage" @click="handleItemPrevPage">
              {{ TXT.prevPage }}
            </button>
            <span class="pager-indicator">{{ pageNo }} / {{ itemPageCount }}</span>
            <button class="pager-btn" type="button" :disabled="!canNextItemPage" @click="handleItemNextPage">
              {{ TXT.nextPage }}
            </button>
            <label class="pager-size-label">
              {{ TXT.pageSize }}
              <select class="pager-size" :value="pageSize" @change="handleItemPageSizeChange">
                <option :value="12">12</option>
                <option :value="20">20</option>
                <option :value="40">40</option>
                <option :value="100">100</option>
              </select>
            </label>
          </div>
        </SoftPanel>
      </section>

      <TagFilterSidebar
        :collapsed="sidebarCollapsed"
        :loading="tagLoading"
        :query="tagSearchText"
        :pending-tags="pendingTags"
        :precise-tag-match="pendingPreciseTagMatch"
        :records="tagOptions"
        :total="tagTotal"
        :page-no="tagPageNo"
        :page-size="tagPageSize"
        @toggle-collapsed="toggleTagSidebar"
        @update:query="handleTagSearchChange"
        @update:precise-tag-match="pendingPreciseTagMatch = $event"
        @toggle-tag="togglePendingTag"
        @remove-tag="removePendingTag"
        @clear-tags="clearPendingTags"
        @change-page="changeTagPage"
        @change-page-size="changeTagPageSize"
        @apply-tags="applyPendingTags"
      />
    </div>
    <div class="fab-stack">
      <button
        type="button"
        class="fab-btn"
        :class="{ active: imageOnly }"
        :aria-label="imageOnly ? TXT.imageOnlyOff : TXT.imageOnlyOn"
        :title="imageOnly ? TXT.imageOnlyOff : TXT.imageOnlyOn"
        @click="handleToggleImageOnly"
      >
        <span class="fab-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="9" r="2.2"></circle>
            <path d="M4 6.5a2.5 2.5 0 0 1 2.5-2.5h11a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm2.5-.5a.5.5 0 0 0-.5.5v10.6l4.1-4.2a1.3 1.3 0 0 1 1.9 0l3.2 3.3 2.2-2.2a1.3 1.3 0 0 1 1.9 0l1.7 1.8V6.5a.5.5 0 0 0-.5-.5h-11Z"></path>
          </svg>
        </span>
      </button>
      <button type="button" class="fab-btn" :aria-label="TXT.refresh" :title="TXT.refresh" @click="handleRefreshItems">
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
              <div v-if="Array.isArray(detailItem.tags) && detailItem.tags.length" class="detail-tags">
                <span v-for="tag in detailItem.tags" :key="`detail-tag-${tag}`" class="detail-tag">#{{ tag }}</span>
              </div>
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
.home-layout {
  position: relative;
}

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
  grid-template-columns: auto 1fr auto;
  gap: 0.7rem;
  align-items: center;
}

.segmented {
  --seg-bg: #eef3fa;
  --seg-border: #cfd9e7;
  --seg-shadow: 0 8px 20px rgba(20, 30, 56, 0.08);
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
  width: fit-content;
  justify-self: start;
  background: var(--seg-bg);
  border-radius: 999px;
  padding: 0.2rem;
  border: 1px solid var(--seg-border);
  box-shadow: var(--seg-shadow);
}

.seg-btn {
  border: none;
  background: transparent;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #44536e;
  transition: color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.seg-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.28);
}

.seg-btn:hover {
  background: rgba(255, 255, 255, 0.72);
  color: #1f2a44;
  transform: translateY(-1px);
}

.seg-btn.active {
  background: #1d4ed8;
  color: #ffffff;
  box-shadow: 0 10px 18px rgba(29, 78, 216, 0.3);
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

.card-viewport {
  max-height: min(72vh, 760px);
  overflow: auto;
  padding-right: 0.18rem;
}

.card-virtual-space {
  position: relative;
}

.card-virtual-content {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  display: grid;
  gap: 0.8rem;
}

.card-virtual-content.image-only {
  gap: 0.6rem;
}

.card-row {
  display: grid;
  gap: 0.8rem;
  min-height: 390px;
}

.card-row.image-only {
  gap: 0.6rem;
  min-height: 280px;
}

.card-row .card {
  height: 100%;
}

.card-row .desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

.pager {
  margin-top: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.pager-btn {
  border: 1px solid #cfd9e7;
  background: #ffffff;
  border-radius: 8px;
  padding: 0.34rem 0.72rem;
  font-size: 0.78rem;
  cursor: pointer;
}

.pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pager-indicator {
  font-size: 0.82rem;
  color: #475569;
  min-width: 4.6rem;
  text-align: center;
}

.pager-size-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: #475569;
}

.pager-size {
  border: 1px solid #cfd9e7;
  background: #fff;
  border-radius: 8px;
  padding: 0.2rem 0.35rem;
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
