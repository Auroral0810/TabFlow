<script>
  import { onMount, onDestroy } from 'svelte';
  import { CategoryService } from '../utils/CategoryService';
  import { StorageService } from '../utils/StorageService';
  import MemoryStats from './MemoryStats.svelte';
  import { MemoryService } from '../utils/MemoryService';
  
  /** @type {chrome.tabs.Tab} */
  export let tab;
  export let onCategoryChange;
  export let defaultIcon;
  export let onActivate;
  export let showMemory = false;
  export let showNotes = false;
  export let onAddNote = () => {};
  export let onTogglePin;
  export let onClose = () => {};
  
  let categoryService = new CategoryService();
  let memoryService = new MemoryService();
  let currentCategory = '未分类';
  let showCategorySelect = false;
  let isBookmarked = false;
  let bookmarkId = null;
  let isMuted = false;
  let isHovered = false;
  let predictedCategory = '其他';
  let faviconUrl = '';
  let cachedFavicon = new Map();
  let isHibernated = false;
  let isLoadingCategory = true;
  
  // 使用响应式声明来保持显示的分类与 tab.predictedCategory 同步
  $: predictedCategory = tab.predictedCategory || '其他';

  // 固定标签页的图标样式
  $: pinButtonClass = tab.pinned 
    ? "p-1 hover:bg-gray-200 rounded text-blue-500 bg-blue-50" 
    : "p-1 hover:bg-gray-200 rounded text-gray-500";

  onMount(async () => {
    console.log('TabItem mounted for tab:', tab.title);
    console.log('Current predicted category:', tab.predictedCategory);
    isLoadingCategory = false;
    isMuted = tab.mutedInfo?.muted || false;
    await memoryService.loadHibernatedState();
    isHibernated = memoryService.isTabHibernated(tab.id);
    await updateFavicon();
  });

  onMount(async () => {
    console.log('TabItem mounted, initializing category service...');
    try {
      const initialized = await categoryService.initialize();
      console.log('Category service initialization result:', initialized);
      
      // 直接使用标签页上已有的预测分类
      predictedCategory = tab.predictedCategory;
      console.log('Using category:', predictedCategory);
      
    } catch (error) {
      console.error('分类加载失败:', error);
      predictedCategory = tab.predictedCategory || '其他';
    } finally {
      isLoadingCategory = false;
    }
  });

  async function checkBookmarkStatus() {
    const bookmarks = await chrome.bookmarks.search({ url: tab.url });
    isBookmarked = bookmarks.length > 0;
    if (isBookmarked) {
      bookmarkId = bookmarks[0].id;
    }
  }
  
  async function toggleBookmark() {
    if (isBookmarked) {
      await chrome.bookmarks.remove(bookmarkId);
      isBookmarked = false;
      bookmarkId = null;
    } else {
      const bookmark = await chrome.bookmarks.create({
        title: tab.title,
        url: tab.url
      });
      isBookmarked = true;
      bookmarkId = bookmark.id;
    }
  }


  function handleKeyDown(event, callback) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }

  async function updateTab(updateInfo) {
    try {
      const updatedTab = await chrome.tabs.update(tab.id, updateInfo);
      if (updateInfo.muted !== undefined) {
        isMuted = updatedTab.mutedInfo?.muted || false;
      }
    } catch (error) {
      console.error('更新标签页失败:', error);
    }
  }
  
  async function removeTab() {
    try {
      await chrome.tabs.remove(tab.id);
    } catch (error) {
      console.error('关闭标签页失败:', error);
    }
  }

  async function toggleMute() {
    try {
      const updatedTab = await chrome.tabs.update(tab.id, { 
        muted: !isMuted 
      });
      isMuted = updatedTab.mutedInfo?.muted || false;
    } catch (error) {
      console.error('切换静音状态失败:', error);
    }
  }

  async function activateTab() {
    await updateTab({ active: true });
    onActivate();
  }

  async function closeTab() {
    await chrome.tabs.remove(tab.id);
  }

  async function togglePin() {
    try {
      await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
    } catch (error) {
      console.error('切换固定状态失败:', error);
    }
  }

  // 更新分类的函数
  async function updateCategory(newCategory) {
    try {
      console.log(`Updating category for tab "${tab.title}" from ${tab.predictedCategory} to ${newCategory}`);
      tab.predictedCategory = newCategory;
      if (onCategoryChange) {
        onCategoryChange(tab, newCategory);
      }
    } catch (error) {
      console.error('更新分类失败:', error);
    }
  }

  async function updateFavicon() {
    try {
      if (tab.id && cachedFavicon.has(tab.id)) {
        faviconUrl = cachedFavicon.get(tab.id);
        return;
      }

      if (tab.favIconUrl) {
        faviconUrl = tab.favIconUrl;
      } else {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const link = document.querySelector('link[rel*="icon"]');
            return link ? link.href : null;
          }
        });
        
        if (results && results[0] && results[0].result) {
          faviconUrl = results[0].result;
        }
      }

      if (tab.id) {
        cachedFavicon.set(tab.id, faviconUrl);
      }
    } catch (error) {
      console.error('获取图标失败:', error);
      faviconUrl = '';
    }
  }

  $: if (tab) {
    updateFavicon();
  }

  onDestroy(() => {
    if (tab.id) {
      cachedFavicon.delete(tab.id);
    }
  });

  async function toggleHibernate() {
    try {
      if (isHibernated) {
        await memoryService.restoreTab(tab.id);
        isHibernated = false;
      } else {
        await memoryService.hibernateTab(tab);
        isHibernated = true;
      }
    } catch (error) {
      console.error('切换休眠状态失败:', error);
    }
  }

  function getColorClass(category) {
    const categoryClasses = {
      '学习': 'bg-blue-100 text-blue-800',
      '购物': 'bg-green-100 text-green-800',
      '工作': 'bg-purple-100 text-purple-800',
      '社交': 'bg-yellow-100 text-yellow-800',
      '娱乐': 'bg-pink-100 text-pink-800',
      '新闻': 'bg-gray-100 text-gray-800',
      '开发': 'bg-indigo-100 text-indigo-800',
      '其他': 'bg-gray-100 text-gray-600'
    };
    return categoryClasses[category] || categoryClasses['其他'];
  }
</script>

<div 
  class="flex items-center p-2 hover:bg-gray-50 group relative"
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  role="listitem"
>
  <div 
    class="flex-1 flex items-center cursor-pointer min-w-0" 
    on:click={activateTab}
    role="button"
    tabindex="0"
    on:keydown={(e) => handleKeyDown(e, activateTab)}
  >
    <div class="w-6 h-6 flex-shrink-0 relative mr-2">
      {#if faviconUrl}
        <div class="w-full h-full flex items-center justify-center">
          <img
            src={faviconUrl}
            alt=""
            class="w-4 h-4 object-contain transition-all duration-200"
            style="image-rendering: -webkit-optimize-contrast;"
            referrerpolicy="no-referrer"
            crossorigin="anonymous"
            on:error={(e) => {
              console.log(`图标加载失败: ${faviconUrl}`);
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'flex';
            }}
          />
          <div 
            class="w-5 h-5 bg-gray-100 rounded-full hidden items-center justify-center text-xs text-gray-600 font-medium absolute"
            style="text-rendering: optimizeLegibility;"
          >
            {tab.title.charAt(0).toUpperCase()}
          </div>
        </div>
      {:else}
        <div 
          class="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-600 font-medium"
          style="text-rendering: optimizeLegibility;"
        >
          {tab.title.charAt(0).toUpperCase()}
        </div>
      {/if}
    </div>
    <div class="flex-1 min-w-0">
      <div class="font-medium truncate">{tab.title}</div>
      <div class="flex items-center space-x-2 min-w-0">
        <div 
          class="text-xs text-gray-500 truncate flex-1 max-w-[200px] hover:whitespace-normal hover:overflow-visible hover:absolute hover:bg-white hover:z-10 hover:shadow-lg hover:p-2 hover:rounded hover:border"
          title={tab.url}
        >
          {tab.url}
        </div>
        <div class="flex items-center space-x-2">
          {#if isLoadingCategory}
            <span class="text-xs text-gray-500">分类中...</span>
          {:else}
            <span 
              class="category-tag category-{predictedCategory}"
              on:click|stopPropagation={() => showCategorySelect = !showCategorySelect}
              role="button"
              tabindex="0"
            >
              {predictedCategory}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-1 ml-2">
    {#if showMemory}
      <MemoryStats tabId={tab.id} />
    {/if}


    <button
      class="p-1 hover:bg-gray-200 rounded {isHibernated ? 'text-blue-500' : 'text-gray-500'}"
      on:click|stopPropagation={toggleHibernate}
      title={isHibernated ? "恢复标签页" : "休眠标签页"}
    >
      {isHibernated ? '💤' : '🌙'}
    </button>

    <button
      class={pinButtonClass}
      on:click|stopPropagation={() => onTogglePin()}
      title={tab.pinned ? "取消固定" : "固定标签页"}
    >
      {#if tab.pinned}
        <!-- 固定状态的图标 -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2.17a2 2 0 01-.586 1.414l-3.828 3.829a2 2 0 01-2.828 0L5.586 8.585A2 2 0 015 7.171V5z"/>
          <path d="M10 10v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6h4z"/>
        </svg>
      {:else}
        <!-- 未固定状态的图标 -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5zM9 9h6v10a2 2 0 01-2 2h-2a2 2 0 01-2-2V9z"/>
        </svg>
      {/if}
    </button>

    <button
      class="p-1 hover:bg-gray-200 rounded {isMuted ? 'text-blue-500' : ''}"
      on:click|stopPropagation={toggleMute}
      title={isMuted ? "取消静音" : "静音"}
    >
      {isMuted ? '🔇' : '🔊'}
    </button>

    <button
      class="p-1 hover:bg-gray-200 rounded text-red-500"
      on:click|stopPropagation={() => onClose()}
      title="关闭标签页"
    >
      ✕
    </button>
  </div>

  {#if showCategorySelect}
    <div class="absolute right-0 mt-1 bg-white border rounded shadow-lg z-10">
      <select
        bind:value={predictedCategory}
        on:change={(e) => updateCategory(e.target.value)}
        class="w-full text-sm p-1"
      >
        {#each categoryService.categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<style>
  /* 确保悬停时的 URL 不会被截断 */
  :global(.hover\:whitespace-normal:hover) {
    white-space: normal;
    word-break: break-all;
  }

  .category-tag {
    @apply text-xs px-2 py-1 rounded-full;
  }
  
  .category-学习 { @apply bg-blue-100 text-blue-800; }
  .category-购物 { @apply bg-green-100 text-green-800; }
  .category-工作 { @apply bg-purple-100 text-purple-800; }
  .category-社交 { @apply bg-yellow-100 text-yellow-800; }
  .category-娱乐 { @apply bg-pink-100 text-pink-800; }
  .category-新闻 { @apply bg-gray-100 text-gray-800; }
  .category-开发 { @apply bg-indigo-100 text-indigo-800; }
  .category-其他 { @apply bg-gray-100 text-gray-600; }

  /* 可以添加一些过渡效果 */
  button {
    transition: all 0.2s ease-in-out;
  }
  
  /* 固定状态下的悬停效果 */
  :global(.bg-blue-50:hover) {
    background-color: rgba(59, 130, 246, 0.2);
  }
</style>  