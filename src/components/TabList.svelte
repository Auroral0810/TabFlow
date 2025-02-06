<script>
  import { onMount } from 'svelte';
  import TabItem from './TabItem.svelte';
  import { StorageService } from '../utils/StorageService';
  import { CategoryService } from '../utils/CategoryService';
  
  let tabs = [];
  let isExtension = !!chrome.tabs;
  let searchQuery = '';
  let groupedTabs = {};
  
  // 标签页分组方式
  let groupingMode = 'domain'; // 'domain', 'category', 'none'
  
  let tabCategories = new Map(); // 存储标签页的分类
  
  let selectedTabs = new Set();
  let showBulkActions = false;
  
  let categoryService;
  
  async function loadTabs() {
    if (!isExtension) return;
    
    try {
      const chromeTabs = await chrome.tabs.query({ currentWindow: true });
      tabs = chromeTabs.map(tab => ({
        ...tab,
        domain: new URL(tab.url).hostname
      }));
      
      updateGroupedTabs();
    } catch (error) {
      console.error('加载标签页失败:', error);
      tabs = [];
    }
  }
  
  function handleCategoryChange(tabId, category) {
    tabCategories.set(tabId, category);
    tabCategories = tabCategories; // 触发更新
    if (groupingMode === 'category') {
      updateGroupedTabs();
    }
  }
  
  function updateGroupedTabs() {
    if (groupingMode === 'none') {
      groupedTabs = { '所有标签页': tabs };
      return;
    }
    
    if (groupingMode === 'category') {
      groupedTabs = tabs.reduce((groups, tab) => {
        const category = tabCategories.get(tab.id) || '未分类';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(tab);
        return groups;
      }, {});
    } else {
      groupedTabs = tabs.reduce((groups, tab) => {
        const key = groupingMode === 'domain' ? tab.domain : '未分类';
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(tab);
        return groups;
      }, {});
    }
  }
  
  $: filteredTabs = searchQuery
    ? tabs.filter(tab => 
        tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.url.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tabs;
  
  // 批量操作函数
  async function closeAllInDomain(domain) {
    const tabIds = tabs
      .filter(tab => tab.domain === domain)
      .map(tab => tab.id);
    await chrome.tabs.remove(tabIds);
  }
  
  async function closeOtherTabs() {
    const currentTab = tabs.find(tab => tab.active);
    if (!currentTab) return;
    
    const tabIds = tabs
      .filter(tab => !tab.active && !tab.pinned)
      .map(tab => tab.id);
    await chrome.tabs.remove(tabIds);
  }
  
  async function handleBulkCategoryChange(category) {
    const promises = Array.from(selectedTabs).map(async (tabId) => {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        await handleCategoryChange(tabId, category);
        // 记录到历史
        await StorageService.addToCategoryHistory(tab, category);
      }
    });
    
    await Promise.all(promises);
    selectedTabs.clear();
    selectedTabs = selectedTabs;
    showBulkActions = false;
  }
  
  function toggleTabSelection(tabId) {
    if (selectedTabs.has(tabId)) {
      selectedTabs.delete(tabId);
    } else {
      selectedTabs.add(tabId);
    }
    selectedTabs = selectedTabs;
    showBulkActions = selectedTabs.size > 0;
  }
  
  onMount(() => {
    if (!isExtension) return;
    
    loadTabs();
    
    const updateTabs = () => {
      loadTabs();
    };
    
    if (chrome.tabs) {
      chrome.tabs.onUpdated.addListener(updateTabs);
      chrome.tabs.onRemoved.addListener(updateTabs);
      chrome.tabs.onMoved.addListener(updateTabs);
      chrome.tabs.onAttached.addListener(updateTabs);
      chrome.tabs.onDetached.addListener(updateTabs);
      
      return () => {
        chrome.tabs.onUpdated.removeListener(updateTabs);
        chrome.tabs.onRemoved.removeListener(updateTabs);
        chrome.tabs.onMoved.removeListener(updateTabs);
        chrome.tabs.onAttached.removeListener(updateTabs);
        chrome.tabs.onDetached.removeListener(updateTabs);
      };
    }
  });
</script>

<div class="h-full flex flex-col">
  <!-- 搜索和工具栏 -->
  <div class="sticky top-0 bg-white p-4 space-y-2 shadow-sm z-40">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="搜索标签页..."
      class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    
    <div class="flex justify-between items-center">
      <select
        bind:value={groupingMode}
        class="px-2 py-1 border rounded"
      >
        <option value="none">不分组</option>
        <option value="domain">按域名分组</option>
        <option value="category">按分类分组</option>
      </select>
      
      <button
        class="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
        on:click={closeOtherTabs}
      >
        关闭其他标签页
      </button>
    </div>
  </div>

  <!-- 标签页列表 -->
  <div class="flex-1 overflow-y-auto p-4">
    {#each Object.entries(groupedTabs) as [group, groupTabs]}
      <div class="mb-4">
        <div class="flex items-center justify-between px-2 py-1 bg-gray-100 rounded mb-2">
          <h3 class="font-medium">{group} ({groupTabs.length})</h3>
          {#if groupingMode === 'domain'}
            <button
              class="text-xs text-red-500 hover:text-red-700"
              on:click={() => closeAllInDomain(group)}
            >
              关闭所有
            </button>
          {/if}
        </div>
        
        <div class="space-y-1">
          {#each groupTabs as tab (tab.id)}
            <TabItem {tab} onCategoryChange={handleCategoryChange} />
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
