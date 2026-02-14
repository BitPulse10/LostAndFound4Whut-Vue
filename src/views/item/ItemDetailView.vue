<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../../layouts/AppShell.vue'
import SoftPanel from '../../components/base/SoftPanel.vue'
import BaseButton from '../../components/base/BaseButton.vue'
import { getItemDetailByIdApi } from '../../services/item.api'

const route = useRoute()
const router = useRouter()

const TXT = {
  back: '返回我的发帖',
  loading: '正在加载…',
  emptyDescription: '暂无描述',
  unknownPlace: '未知地点',
  place: '地点',
  eventTime: '事件时间',
  publishTime: '发布时间',
}

const loading = ref(false)
const error = ref('')
const item = ref(null)

const typeText = computed(() => {
  if (item.value?.type === 1) return '招领'
  if (item.value?.type === 0) return '挂失'
  if (item.value?.type === 2) return '卡证'
  return '未分类'
})

const statusText = computed(() => {
  if (item.value?.status === 0) return '进行中'
  if (item.value?.status === 1) return '已关闭'
  return '未知状态'
})

const formatDateTime = (value) => {
  if (!value) return '时间未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const fetchItem = async () => {
  const id = Number(route.params.id)
  if (!Number.isFinite(id) || id <= 0) {
    error.value = '非法的物品 ID'
    return
  }

  loading.value = true
  error.value = ''
  try {
    item.value = await getItemDetailByIdApi(id)
  } catch (err) {
    error.value = err?.message || '加载详情失败'
  } finally {
    loading.value = false
  }
}

onMounted(fetchItem)
</script>

<template>
  <AppShell>
    <section class="detail">
      <div class="top-actions">
        <BaseButton variant="ghost" @click="router.push('/profile')">{{ TXT.back }}</BaseButton>
      </div>

      <SoftPanel class="panel">
        <p v-if="loading" class="muted" role="status" aria-live="polite">{{ TXT.loading }}</p>
        <p v-else-if="error" class="error" role="alert" aria-live="polite">{{ error }}</p>

        <template v-else-if="item">
          <header class="head">
            <span class="chip type">{{ typeText }}</span>
            <span class="chip status">{{ statusText }}</span>
          </header>

          <h2 class="title">{{ item.description || TXT.emptyDescription }}</h2>

          <dl class="meta">
            <div>
              <dt>{{ TXT.place }}</dt>
              <dd>{{ item.eventPlace || TXT.unknownPlace }}</dd>
            </div>
            <div>
              <dt>{{ TXT.eventTime }}</dt>
              <dd>{{ formatDateTime(item.eventTime) }}</dd>
            </div>
            <div>
              <dt>{{ TXT.publishTime }}</dt>
              <dd>{{ formatDateTime(item.createdAt) }}</dd>
            </div>
          </dl>

          <div v-if="item.tags?.length" class="tags">
            <span v-for="tag in item.tags" :key="`tag-${tag}`" class="tag">#{{ tag }}</span>
          </div>
        </template>
      </SoftPanel>
    </section>
  </AppShell>
</template>

<style scoped>
.detail {
  display: grid;
  gap: 1.2rem;
}

.top-actions {
  width: 10rem;
}

.panel {
  padding: 1.2rem;
  background: #ffffff;
  border-radius: 20px;
  border: 2px solid #d7dee8;
}

.head {
  display: flex;
  gap: 0.4rem;
}

.chip {
  border-radius: 999px;
  padding: 0.25rem 0.58rem;
  font-size: 0.74rem;
}

.chip.type {
  background: #e7f0ff;
  color: var(--accent-alt);
}

.chip.status {
  background: #eef2f7;
  color: var(--text-secondary);
}

.title {
  margin-top: 0.8rem;
  font-size: 1.35rem;
  overflow-wrap: anywhere;
}

.meta {
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
}

.meta dt {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.meta dd {
  margin-top: 0.15rem;
}

.tags {
  margin-top: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  border-radius: 999px;
  border: 1px solid #d7dee8;
  background: #e7f0ff;
  color: var(--accent-alt);
  font-size: 0.74rem;
  padding: 0.18rem 0.5rem;
}

.muted {
  color: var(--text-secondary);
}

.error {
  color: #8d2c22;
}
</style>
