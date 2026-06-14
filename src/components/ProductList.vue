<template>
  <div class="product-list">
    <h3>已保存商品</h3>
    <div v-if="products.length === 0" class="empty">暂无商品数据</div>
    <div v-for="product in products" :key="product.id" class="product-item">
      <div class="product-name">{{ product.ext_product_name }}</div>
      <div class="product-meta">
        {{ product.ext_from }} | ID: {{ product.ext_product_id }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { ProductData } from '@/shared/types';
import { apiGet } from '@/content/utils/api';
import { API_PATHS } from '@/shared/constants';

export default defineComponent({
  name: 'ProductList',
  data() {
    return {
      products: [] as ProductData[],
    };
  },
  async mounted() {
    try {
      const result = await apiGet(API_PATHS.PRODUCT_GET, {
        ext_from: '1688',
        ext_product_id: '',
      });
      if (result.code === '200' && result.result) {
        this.products = [result.result as unknown as ProductData];
      }
    } catch {
      /* keep empty list */
    }
  },
});
</script>
