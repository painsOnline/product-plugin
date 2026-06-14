<template>
  <div class="image-preview">
    <h4>{{ title }}</h4>
    <div class="image-grid">
      <div v-for="(url, idx) in images" :key="idx" class="image-item">
        <img :src="url" :alt="`图片 ${idx + 1}`" />
        <div v-if="imageSizes[idx]" class="image-size">
          {{ formatSize(imageSizes[idx]) }}
        </div>
      </div>
    </div>
    <div v-if="images.length === 0" class="empty">暂无图片</div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ImagePreview',
  props: {
    title: { type: String, default: '图片预览' },
    images: { type: Array as () => string[], default: () => [] },
    imageSizes: { type: Array as () => number[], default: () => [] },
  },
  methods: {
    formatSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
  },
});
</script>
