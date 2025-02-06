<script>
  import { onMount } from 'svelte';
  import TabItem from './components/TabItem.svelte';
  import TabSearch from './components/TabSearch.svelte';
  import SessionManager from './components/SessionManager.svelte';
  import MemoryMonitor from './components/MemoryMonitor.svelte';
  import Settings from './components/Settings.svelte';
  import { TabGroupService } from './utils/TabGroupService';
  import { defaultIcon } from './assets/icons';
  
  let activeTab = 'tabs';
  let searchQuery = '';
  let tabs = [];
  let groupMode = 'none';
  let showSidebar = false;
  let groups = [];
  let showMemoryWarning = false;
  let filteredTabs = [];
  
  const tabGroupService = new TabGroupService(defaultIcon);

  onMount(async () => {
    try {
      tabs = await chrome.tabs.query({ currentWindow: true });
      filteredTabs = tabs;
      tabs.forEach(tab => {
        tabGroupService.updateAccessTime(tab.id);
      });
    } catch (error) {
      console.error('加载标签页时出错:', error);
    }
  });

  $: groups = (() => {
    const tabsToGroup = searchQuery ? filteredTabs : tabs;
    
    // 首先分离固定标签页
    const pinnedTabs = tabsToGroup.filter(tab => tab.pinned);
    const unpinnedTabs = tabsToGroup.filter(tab => !tab.pinned);
    
    let groupedTabs = [];
    
    // 如果有固定标签页，添加固定标签页组
    if (pinnedTabs.length > 0) {
      groupedTabs.push({
        title: '固定标签页',
        tabs: pinnedTabs
      });
    }
    
    // 根据选择的分组模式处理未固定的标签页
    switch (groupMode) {
      case 'domain':
        const domainGroups = tabGroupService.groupByDomain(unpinnedTabs);
        groupedTabs = [...groupedTabs, ...domainGroups];
        break;
      case 'time':
        const timeGroups = tabGroupService.groupByLastAccess(unpinnedTabs);
        groupedTabs = [...groupedTabs, ...timeGroups];
        break;
      default:
        if (unpinnedTabs.length > 0) {
          groupedTabs.push({
            title: '未固定标签页',
            tabs: unpinnedTabs
          });
        }
    }
    
    return groupedTabs;
  })();

  async function closeTabs(option, params = {}) {
    try {
      const currentTab = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTabId = currentTab[0].id;
      
      switch (option) {
        case 'all':
          const allTabs = await chrome.tabs.query({ currentWindow: true });
          await chrome.tabs.remove(allTabs.map(tab => tab.id));
          break;
          
        case 'others':
          const otherTabs = await chrome.tabs.query({ 
            active: false, 
            currentWindow: true,
            pinned: false // 不关闭固定的标签页
          });
          await chrome.tabs.remove(otherTabs.map(tab => tab.id));
          break;
          
        case 'byGroup':
          if (params.tabs) {
            const tabsToClose = params.tabs.filter(tab => 
              !tab.pinned && // 不关闭固定的标签页
              tab.id !== currentTabId // 不关闭当前标签页
            );
            await chrome.tabs.remove(tabsToClose.map(tab => tab.id));
          }
          break;
      }
      
      // 更新标签页列表
      tabs = await chrome.tabs.query({ currentWindow: true });
      filteredTabs = tabs;
    } catch (error) {
      console.error('关闭标签页失败:', error);
    }
  }

  $: domains = [...new Set(tabs.map(tab => {
    try {
      return new URL(tab.url).hostname;
    } catch (e) {
      return null;
    }
  }))].filter(Boolean);

  // 监听标签页激活事件
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    tabGroupService.updateAccessTime(activeInfo.tabId);
  });

  // 监听标签页更新事件
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      tabGroupService.updateAccessTime(tabId);
    }
    if (changeInfo.pinned !== undefined) {
      tabs = tabs.map(t => t.id === tabId ? { ...t, pinned: changeInfo.pinned } : t);
    }
  });

  // 添加点击外部关闭的处理函数
  function handleClickOutside(event) {
    const menu = document.getElementById('closeMenu');
    const button = document.getElementById('closeButton');
    
    if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
      showSidebar = false;
    }
  }

  // 组件挂载时添加点击事件监听
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  function handleSearch({ detail }) {
    searchQuery = detail.query;
    if (!searchQuery) {
      filteredTabs = tabs;
    } else {
      const query = searchQuery.toLowerCase();
      filteredTabs = tabs.filter(tab => 
        tab.title.toLowerCase().includes(query) || 
        tab.url.toLowerCase().includes(query)
      );
    }
  }

  // 固定标签页
  async function togglePin(tabId, pinned) {
    try {
      await chrome.tabs.update(tabId, { pinned: !pinned });
      // 更新本地标签页状态
      tabs = await chrome.tabs.query({ currentWindow: true });
    } catch (error) {
      console.error('固定标签页失败:', error);
    }
  }

  $: {
    console.log('当前分组模式:', groupMode);
    console.log('搜索关键词:', searchQuery);
    console.log('过滤后的分组:', groups);
  }
</script>

<div class="min-w-[800px] max-w-[1200px] bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg shadow-lg">
  <!-- 顶部导航 -->
  <nav class="bg-white rounded-lg shadow-sm mb-4 p-1">
    <div class="flex items-center justify-between">
      <div class="flex space-x-2">
        <button
          class="px-4 py-2 rounded-lg transition-colors duration-200 {activeTab === 'tabs' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}"
          on:click={() => activeTab = 'tabs'}
        >
          标签页管理
        </button>
        <button
          class="px-4 py-2 rounded-lg transition-colors duration-200 {activeTab === 'sessions' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}"
          on:click={() => activeTab = 'sessions'}
        >
          会话管理
        </button>
        <button
          class="px-4 py-2 rounded-lg transition-colors duration-200 {activeTab === 'settings' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}"
          on:click={() => activeTab = 'settings'}
        >
          设置
        </button>
      </div>
      
      {#if activeTab === 'tabs'}
        <TabSearch 
          bind:searchQuery 
          on:search={handleSearch}
        />
      {/if}
    </div>
  </nav>

  <!-- 内存监控提示 -->
  {#if showMemoryWarning}
    <MemoryMonitor />
  {/if}

  <!-- 主要内容区域 -->
  <main class="bg-white rounded-lg shadow-sm p-4">
    {#if activeTab === 'tabs'}
      <!-- 标签页管理 -->
      <div class="mb-4 flex items-center justify-between">
        <select
          class="px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          bind:value={groupMode}
        >
          <option value="none">不分组</option>
          <option value="domain">按网站分组</option>
          <option value="time">按时间分组</option>
          <option value="smart">智能分类</option>
          <option value="custom">自定义分类</option>
        </select>
        
        <div class="flex gap-2">
          <button
            class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center gap-2"
            on:click={() => closeTabs('others')}
          >
            关闭其他标签页
          </button>
          <button
            class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center gap-2"
            on:click={() => closeTabs('all')}
          >
            关闭所有标签页
          </button>
        </div>
      </div>

      <!-- 标签页列表 -->
      <div class="space-y-4">
        {#each groups as group}
          <div class="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
            <div class="bg-gray-50 px-4 py-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h2 class="font-medium text-gray-700">
                  {group.title} ({group.tabs.length})
                </h2>
              </div>
              {#if group.title !== '固定标签页'}
                <div class="flex items-center gap-2">
                  <button
                    class="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors duration-200 flex items-center gap-1.5 text-sm font-medium"
                    on:click={() => closeTabs('byGroup', { tabs: group.tabs })}
                  >
                    关闭此组
                  </button>
                </div>
              {/if}
            </div>
            <div class="divide-y divide-gray-100">
              {#each group.tabs as tab}
                <TabItem 
                  {tab} 
                  defaultIcon={tabGroupService.defaultIcon}
                  onTogglePin={() => togglePin(tab.id, tab.pinned)}
                />
              {/each}
            </div>
          </div>
        {/each}
      </div>

    {:else if activeTab === 'sessions'}
      <SessionManager />
    {:else if activeTab === 'settings'}
      <Settings />
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: transparent;
  }

  :global(html) {
    width: 800px;
    height: 600px;
  }

  /* 自定义滚动条样式 */
  :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  :global(::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: #cbd5e1;
    border-radius: 4px;
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: #94a3b8;
  }
</style>
