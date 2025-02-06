<script>
  import { onMount } from 'svelte';
  import { CategoryService } from '../utils/CategoryService';
  
  let categoryService;
  let categories = [];
  let rules = {};
  let newCategory = '';
  let newRule = '';
  let selectedCategory = '';
  
  onMount(async () => {
    categoryService = new CategoryService();
    await categoryService.initialize();
    categories = categoryService.categories;
    rules = categoryService.keywordMap;
  });
  
  async function addCategory() {
    if (newCategory && await categoryService.addCategory(newCategory)) {
      categories = [...categories, newCategory];
      newCategory = '';
    }
  }
  
  async function removeCategory(category) {
    if (await categoryService.removeCategory(category)) {
      categories = categories.filter(c => c !== category);
      delete rules[category];
    }
  }
  
  async function addRule() {
    if (selectedCategory && newRule && 
        await categoryService.addCategoryRule(selectedCategory, newRule)) {
      rules = {
        ...rules,
        [selectedCategory]: [...(rules[selectedCategory] || []), newRule]
      };
      newRule = '';
    }
  }
  
  async function removeRule(category, rule) {
    if (await categoryService.removeCategoryRule(category, rule)) {
      rules = {
        ...rules,
        [category]: rules[category].filter(r => r !== rule)
      };
    }
  }
</script>

<div class="p-4 space-y-4">
  <div class="space-y-2">
    <h3 class="font-bold">添加新分类</h3>
    <div class="flex space-x-2">
      <input
        type="text"
        bind:value={newCategory}
        placeholder="输入新分类名称"
        class="flex-1 px-2 py-1 border rounded"
      />
      <button
        on:click={addCategory}
        class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        添加
      </button>
    </div>
  </div>

  <div class="space-y-2">
    <h3 class="font-bold">添加分类规则</h3>
    <div class="flex space-x-2">
      <select
        bind:value={selectedCategory}
        class="px-2 py-1 border rounded"
      >
        <option value="">选择分类</option>
        {#each categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
      <input
        type="text"
        bind:value={newRule}
        placeholder="输入关键词"
        class="flex-1 px-2 py-1 border rounded"
      />
      <button
        on:click={addRule}
        class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        添加规则
      </button>
    </div>
  </div>

  <div class="space-y-4">
    <h3 class="font-bold">现有分类和规则</h3>
    {#each categories as category}
      <div class="border rounded p-2">
        <div class="flex justify-between items-center">
          <h4 class="font-medium">{category}</h4>
          <button
            on:click={() => removeCategory(category)}
            class="text-red-500 hover:text-red-700"
          >
            删除
          </button>
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each rules[category] || [] as rule}
            <div class="flex items-center bg-gray-100 rounded px-2 py-1">
              <span class="text-sm">{rule}</span>
              <button
                on:click={() => removeRule(category, rule)}
                class="ml-2 text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div> 