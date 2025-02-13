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
  
  onMount(async () => {
    isMuted = tab.mutedInfo?.muted || false;
    await memoryService.loadHibernatedState();
    isHibernated = memoryService.isTabHibernated(tab.id);
    await updateFavicon();
  });

  onMount(async () => {
    await categoryService.initialize();
    predictedCategory = await categoryService.predictCategory(tab);
    await updateFavicon();
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

  async function updateCategory(newCategory) {
    predictedCategory = newCategory;
    await categoryService.trainOnUserFeedback(tab, newCategory);
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
        <button
          class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 truncate max-w-[100px] flex-shrink-0"
          on:click|stopPropagation={() => showCategorySelect = !showCategorySelect}
        >
          {currentCategory}
        </button>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-1 ml-2">
    {#if showMemory}
      <MemoryStats tabId={tab.id} />
    {/if}
    
    {#if showNotes}
      <button
        class="p-1 hover:bg-gray-200 rounded text-gray-500"
        on:click={onAddNote}
        title="添加备注"
      >
        📝
      </button>
    {/if}

    <button
      class="p-1 hover:bg-gray-200 rounded {isHibernated ? 'text-blue-500' : 'text-gray-500'}"
      on:click|stopPropagation={toggleHibernate}
      title={isHibernated ? "恢复标签页" : "休眠标签页"}
    >
      {isHibernated ? '💤' : '🌙'}
    </button>

    <button
      class="p-1 hover:bg-gray-200 rounded {tab.pinned ? 'text-blue-500' : ''}"
      on:click|stopPropagation={togglePin}
      title={tab.pinned ? "取消固定" : "固定标签页"}
    >
      📌
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
      on:click|stopPropagation={closeTab}
      title="关闭标签页"
    >
      ✕
    </button>
  </div>

  {#if showCategorySelect}
    <select
      bind:value={predictedCategory}
      on:change={(e) => updateCategory(e.target.value)}
      class="ml-2 text-sm border rounded"
    >
      {#each categoryService.categories as category}
        <option value={category}>{category}</option>
      {/each}
    </select>
  {/if}
</div>

<style>
  /* 确保悬停时的 URL 不会被截断 */
  :global(.hover\:whitespace-normal:hover) {
    white-space: normal;
    word-break: break-all;
  }
</style> 