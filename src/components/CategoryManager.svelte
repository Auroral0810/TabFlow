<script>
  import { onMount } from 'svelte';
  import { CategoryService } from '../utils/CategoryService';
  
  export let tab;
  export let onCategoryChange;
  
  let categoryService;
  let predictedCategory = '其他';
  let isLoading = true;
  
  onMount(async () => {
    categoryService = new CategoryService();
    await categoryService.initialize();
    predictedCategory = await categoryService.predictCategory(tab);
    isLoading = false;
  });
  
  async function updateCategory(newCategory) {
    if (!categoryService) return;
    
    // 更新分类
    predictedCategory = newCategory;
    // 训练模型
    await categoryService.trainOnUserFeedback(tab, newCategory);
    // 通知父组件
    if (onCategoryChange) {
      onCategoryChange(tab.id, newCategory);
    }
  }
</script>

<div class="relative inline-block">
  {#if isLoading}
    <span class="text-xs text-gray-500">分析中...</span>
  {:else}
    <select
      value={predictedCategory}
      on:change={(e) => updateCategory(e.target.value)}
      class="text-xs border rounded px-1 py-0.5 bg-gray-50 hover:bg-gray-100"
    >
      {#each categoryService?.categories || [] as category}
        <option value={category}>{category}</option>
      {/each}
    </select>
  {/if}
</div> 