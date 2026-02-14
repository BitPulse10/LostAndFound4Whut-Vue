<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  collapsed: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
  query: { type: String, default: '' },
  pendingTags: { type: Array, default: () => [] },
  preciseTagMatch: { type: Boolean, default: false },
  records: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  pageNo: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
})

const emit = defineEmits([
  'toggle-collapsed',
  'update:query',
  'toggle-tag',
  'update:preciseTagMatch',
  'remove-tag',
  'clear-tags',
  'change-page',
  'change-page-size',
  'apply-tags',
])

const pageCount = computed(() => {
  if (!props.total || !props.pageSize) return 1
  return Math.max(1, Math.ceil(props.total / props.pageSize))
})

const canPrev = computed(() => props.pageNo > 1)
const canNext = computed(() => props.pageNo < pageCount.value)
const TAG_COLUMNS = 2
const TAG_ROW_SIZE = 42
const TAG_OVERSCAN = 3
const tagViewportRef = ref(null)
const tagScrollTop = ref(0)
const tagViewportHeight = ref(320)
let tagViewportResizeObserver = null

const onPrevPage = () => {
  if (!canPrev.value) return
  emit('change-page', props.pageNo - 1)
}

const onNextPage = () => {
  if (!canNext.value) return
  emit('change-page', props.pageNo + 1)
}

const onPageSizeChange = (event) => {
  emit('change-page-size', Number(event.target.value))
}

const onTagClick = (name) => emit('toggle-tag', name)
const onRemoveChip = (name) => emit('remove-tag', name)

const tagRows = computed(() => {
  const rows = []
  for (let i = 0; i < props.records.length; i += TAG_COLUMNS) {
    rows.push({
      rowIndex: Math.floor(i / TAG_COLUMNS),
      tags: props.records.slice(i, i + TAG_COLUMNS),
    })
  }
  return rows
})

const visibleStartRow = computed(() => Math.max(0, Math.floor(tagScrollTop.value / TAG_ROW_SIZE) - TAG_OVERSCAN))
const visibleRowCount = computed(() => Math.ceil(tagViewportHeight.value / TAG_ROW_SIZE) + TAG_OVERSCAN * 2)
const visibleEndRow = computed(() => Math.min(tagRows.value.length, visibleStartRow.value + visibleRowCount.value))
const visibleTagRows = computed(() => tagRows.value.slice(visibleStartRow.value, visibleEndRow.value))
const tagTopSpacerHeight = computed(() => visibleStartRow.value * TAG_ROW_SIZE)
const tagBottomSpacerHeight = computed(() => Math.max(0, (tagRows.value.length - visibleEndRow.value) * TAG_ROW_SIZE))

const updateTagViewportHeight = () => {
  const el = tagViewportRef.value
  if (!el) return
  tagViewportHeight.value = el.clientHeight || 320
}

const onTagListScroll = (event) => {
  tagScrollTop.value = event.target?.scrollTop || 0
}

watch(
  () => [props.records, props.pageNo, props.pageSize],
  () => {
    tagScrollTop.value = 0
    if (tagViewportRef.value) {
      tagViewportRef.value.scrollTop = 0
    }
    updateTagViewportHeight()
  },
  { deep: true },
)

onMounted(() => {
  updateTagViewportHeight()
  if (typeof ResizeObserver === 'function' && tagViewportRef.value) {
    tagViewportResizeObserver = new ResizeObserver(() => updateTagViewportHeight())
    tagViewportResizeObserver.observe(tagViewportRef.value)
  }
})

onBeforeUnmount(() => {
  if (tagViewportResizeObserver) {
    tagViewportResizeObserver.disconnect()
    tagViewportResizeObserver = null
  }
})
</script>

<template>
  <aside class="tag-sidebar" :class="{ collapsed }" aria-label="标签筛选边栏">
    <button
      class="collapse-handle"
      type="button"
      :aria-label="collapsed ? '展开标签筛选边栏' : '收起标签筛选边栏'"
      :title="collapsed ? '展开标签筛选' : '收起标签筛选'"
      @click="$emit('toggle-collapsed')"
    >
      <span class="icon" aria-hidden="true">筛</span>
      <span class="label">标签</span>
      <span class="count" v-if="pendingTags.length">{{ pendingTags.length }}</span>
    </button>

    <div class="panel" v-if="!collapsed">
      <header class="panel-head">
        <h3>标签筛选</h3>
      </header>

      <label class="search-wrap">
        <span class="sr-only">搜索标签</span>
        <input
          class="search-input"
          type="search"
          name="tag-search"
          autocomplete="off"
          placeholder="搜索标签…"
          :value="query"
          @input="$emit('update:query', $event.target.value)"
        />
      </label>

      <div class="match-mode">
        <span class="mode-label">匹配模式</span>
        <div class="mode-segmented" role="group" aria-label="标签匹配模式">
          <button
            class="mode-btn"
            :class="{ active: !preciseTagMatch }"
            type="button"
            @click="$emit('update:preciseTagMatch', false)"
          >
            广泛
          </button>
          <button
            class="mode-btn"
            :class="{ active: preciseTagMatch }"
            type="button"
            @click="$emit('update:preciseTagMatch', true)"
          >
            精确
          </button>
        </div>
      </div>

      <div class="chips-wrap" v-if="pendingTags.length">
        <button
          v-for="tag in pendingTags"
          :key="`chip-${tag}`"
          class="chip"
          type="button"
          @click="onRemoveChip(tag)"
        >
          <span>#{{ tag }}</span>
          <span class="x">x</span>
        </button>
        <button class="clear-btn" type="button" @click="$emit('clear-tags')">清空</button>
      </div>

      <p class="meta">共 {{ total }} 个标签</p>

      <div ref="tagViewportRef" class="tag-list" role="listbox" aria-label="标签列表" @scroll="onTagListScroll">
        <p v-if="loading" class="state">加载中…</p>
        <p v-else-if="!records.length" class="state">暂无标签</p>
        <div v-else class="tag-virtual-list">
          <div class="tag-spacer" :style="{ height: `${tagTopSpacerHeight}px` }" aria-hidden="true"></div>
          <div v-for="row in visibleTagRows" :key="`tag-row-${row.rowIndex}`" class="tag-row">
            <button
              v-for="tag in row.tags"
              :key="`tag-${tag.id ?? tag.name}`"
              class="tag-item"
              :class="{ active: pendingTags.includes(tag.name) }"
              type="button"
              @click="onTagClick(tag.name)"
            >
              #{{ tag.name }}
            </button>
          </div>
          <div class="tag-spacer" :style="{ height: `${tagBottomSpacerHeight}px` }" aria-hidden="true"></div>
        </div>
      </div>

      <div class="pager">
        <div class="pager-row">
          <button class="pager-btn" type="button" :disabled="!canPrev" @click="onPrevPage">上一页</button>
          <span class="page-indicator">{{ pageNo }} / {{ pageCount }}</span>
          <button class="pager-btn" type="button" :disabled="!canNext" @click="onNextPage">下一页</button>
        </div>
        <div class="pager-row">
          <label class="page-size-label">
            每页
            <select class="page-size" :value="pageSize" @change="onPageSizeChange">
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>
          <button class="apply-btn" type="button" @click="$emit('apply-tags')">应用筛选</button>
        </div>
        <p class="hint-text">刷新结果请用右下角刷新按钮，当前标签选择会保留。</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.tag-sidebar {
  position: fixed;
  top: 7.2rem;
  right: 1.35rem;
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  gap: 0.5rem;
  z-index: 70;
}

.tag-sidebar.collapsed {
  gap: 0;
}

.collapse-handle {
  position: relative;
  height: 3.8rem;
  width: 3rem;
  border-radius: 14px;
  border: 1px solid #cfd9e7;
  background: #ffffff;
  cursor: pointer;
  color: #1f2a44;
  display: grid;
  grid-template-rows: 1fr 1fr;
  place-items: center;
}

.collapse-handle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.25);
}

.icon {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1;
}

.label {
  font-size: 0.78rem;
  color: #475569;
  line-height: 1;
}

.count {
  position: absolute;
  top: -0.42rem;
  right: -0.36rem;
  min-width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: #111827;
  color: #fff;
  font-size: 0.78rem;
  display: grid;
  place-items: center;
}

.panel {
  width: min(300px, calc(100vw - 4.8rem));
  border: 1px solid #d7dee8;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 16px 32px rgba(24, 33, 64, 0.1);
  padding: 0.9rem;
  display: grid;
  gap: 0.8rem;
}

.panel-head h3 {
  margin: 0;
  font-size: 1rem;
}

.search-input {
  width: 100%;
  border: 1px solid #d7dee8;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
  background: #f8fafc;
}

.match-mode {
  display: grid;
  gap: 0.35rem;
}

.mode-label {
  font-size: 0.74rem;
  color: #64748b;
}

.mode-segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.35rem;
}

.mode-btn {
  border: 1px solid #cfd9e7;
  background: #fff;
  color: #334155;
  border-radius: 8px;
  padding: 0.35rem 0.45rem;
  font-size: 0.76rem;
  cursor: pointer;
}

.mode-btn.active {
  border-color: #1d4ed8;
  background: #dbeafe;
  color: #1e3a8a;
}

.mode-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.2);
}

.chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.chip {
  border: 1px solid #c4d4ec;
  background: #eff6ff;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  color: #1e3a8a;
  cursor: pointer;
  font-size: 0.76rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.2);
}

.x {
  font-size: 0.7rem;
  color: #3b4e73;
}

.clear-btn {
  border: 1px dashed #c5cfdf;
  background: #fff;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  font-size: 0.74rem;
  cursor: pointer;
}

.clear-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.2);
}

.meta {
  margin: 0;
  color: #64748b;
  font-size: 0.77rem;
}

.tag-list {
  max-height: 320px;
  overflow: auto;
  position: relative;
}

.tag-virtual-list {
  display: grid;
  gap: 0;
}

.tag-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  margin-bottom: 0.45rem;
  min-height: 2.15rem;
}

.tag-spacer {
  width: 100%;
}

.state {
  margin: 0;
  grid-column: 1 / -1;
  color: #64748b;
  font-size: 0.82rem;
}

.tag-item {
  border: 1px solid #d4ddeb;
  background: #ffffff;
  border-radius: 999px;
  padding: 0.35rem 0.55rem;
  font-size: 0.76rem;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-item.active {
  border-color: #1d4ed8;
  background: #dbeafe;
  color: #1e3a8a;
}

.tag-item:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.2);
}

.pager {
  display: grid;
  gap: 0.5rem;
}

.hint-text {
  margin: 0;
  color: #64748b;
  font-size: 0.74rem;
  line-height: 1.45;
}

.pager-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.pager-btn {
  border: 1px solid #cfd9e7;
  background: #fff;
  border-radius: 8px;
  padding: 0.28rem 0.6rem;
  cursor: pointer;
  font-size: 0.76rem;
}

.pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pager-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.2);
}

.page-indicator {
  color: #64748b;
  font-size: 0.76rem;
}

.page-size-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #475569;
  font-size: 0.76rem;
}

.page-size {
  border: 1px solid #cfd9e7;
  border-radius: 8px;
  padding: 0.2rem 0.3rem;
  font-size: 0.76rem;
}

.apply-btn {
  border: none;
  background: #111827;
  color: #fff;
  border-radius: 9px;
  padding: 0.35rem 0.72rem;
  cursor: pointer;
  font-size: 0.78rem;
}

.apply-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.25);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 1024px) {
  .tag-sidebar {
    right: 1rem;
    top: 6.8rem;
  }

  .panel {
    max-height: min(64vh, 540px);
    overflow: auto;
  }
}
</style>
