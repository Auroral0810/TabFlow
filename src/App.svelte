<script>
  import { onMount } from 'svelte';
  import TabItem from './components/TabItem.svelte';
  import TabSearch from './components/TabSearch.svelte';
  import SessionManager from './components/SessionManager.svelte';
  import MemoryMonitor from './components/MemoryMonitor.svelte';
  import Settings from './components/Settings.svelte';
  import { TabGroupService } from './utils/TabGroupService';
  import { defaultIcon } from './assets/icons';
  import { MemoryService } from './utils/MemoryService';
  import MemoryMonitorPage from './components/MemoryMonitorPage.svelte';
  import QuickTabSwitcher from './components/QuickTabSwitcher.svelte';
  import { CategoryService } from './utils/CategoryService';
  
  let activeTab = 'tabs';
  let searchQuery = '';
  let tabs = [];
  let groupMode = 'none';
  let showSidebar = false;
  let groups = [];
  let showMemoryWarning = false;
  let filteredTabs = [];
  let showMemory = false;
  
  // 存储标签页的分类信息
  let tabCategories = new Map();
  
  const tabGroupService = new TabGroupService(defaultIcon);
  const memoryService = new MemoryService();
  const categoryService = new CategoryService();

  onMount(async () => {
    try {
      await categoryService.initialize();
      
      // 获取所有标签页
      tabs = await chrome.tabs.query({ currentWindow: true });
      
      console.log('开始为标签页预测分类...');
      
      // 为每个标签页预测分类并存储
      for (const tab of tabs) {
        if (!tabCategories.has(tab.id)) {
          const category = await categoryService.predictCategory(tab);
          tabCategories.set(tab.id, category);
          tab.predictedCategory = category;
          console.log(`标签页预测结果 - 标题: "${tab.title}" => 分类: ${category}`);
        } else {
          tab.predictedCategory = tabCategories.get(tab.id);
          console.log(`使用已存储的分类 - 标题: "${tab.title}" => 分类: ${tab.predictedCategory}`);
        }
      }
      
      filteredTabs = tabs;
      
      // 更新访问时间
      tabs.forEach(tab => {
        tabGroupService.updateAccessTime(tab.id);
      });
      
      // 初始化内存监控
      chrome.tabs.query({ currentWindow: true }, async (tabs) => {
        tabs.forEach(tab => {
          memoryService.updateTabMemoryInfo(tab.id);
        });
      });
      
      // 监听内存警告
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'memoryWarning') {
          showMemoryWarning = true;
        }
      });
    } catch (error) {
      console.error('加载标签页时出错:', error);
    }
  });

  // 监听标签页关闭事件
  chrome.tabs.onRemoved.addListener((tabId) => {
    console.log(`标签页被关闭: ${tabId}`);
    // 从列表和分类存储中移除该标签页
    tabs = tabs.filter(tab => tab.id !== tabId);
    tabCategories.delete(tabId);
    filteredTabs = filteredTabs.filter(tab => tab.id !== tabId);
  });

  // 处理关闭标签页组
  async function closeGroup(group) {
    console.log(`关闭分组: ${group.title}`);
    const tabIds = group.tabs.map(tab => tab.id);
    
    // 在关闭标签页之前保存它们的分类
    for (const tab of group.tabs) {
      console.log(`保存标签页分类 - 标题: "${tab.title}" => 分类: ${tab.predictedCategory}`);
      tabCategories.set(tab.id, tab.predictedCategory);
    }
    
    // 关闭标签页
    await Promise.all(tabIds.map(id => chrome.tabs.remove(id)));
    
    // 更新标签页列表，保持其他标签页的分类不变
    tabs = tabs.filter(tab => !tabIds.includes(tab.id));
    tabs = tabs.map(tab => ({
      ...tab,
      predictedCategory: tabCategories.get(tab.id) || tab.predictedCategory || '其他'
    }));
    
    console.log('关闭分组后的标签页分类:', tabs.map(tab => ({
      title: tab.title,
      category: tab.predictedCategory
    })));
    
    filteredTabs = tabs;
  }

  // 处理分类变更
  function handleCategoryChange(tab, newCategory) {
    console.log(`分类变更 - 标题: "${tab.title}" 从 ${tab.predictedCategory} 改为 ${newCategory}`);
    const tabIndex = tabs.findIndex(t => t.id === tab.id);
    if (tabIndex !== -1) {
      tabCategories.set(tab.id, newCategory);
      tabs[tabIndex].predictedCategory = newCategory;
      tabs = [...tabs];
    }
  }

  async function togglePin(tab) {
    try {
      console.log(`切换标签页固定状态: ${tab.title}`);
      await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
      
      // 只更新这个标签页的固定状态，不重新排序
      const tabIndex = tabs.findIndex(t => t.id === tab.id);
      if (tabIndex !== -1) {
        tabs[tabIndex].pinned = !tab.pinned;
        // 使用展开运算符创建新数组以触发响应式更新，但保持顺序不变
        tabs = [...tabs];
      }
    } catch (error) {
      console.error('切换固定状态失败:', error);
    }
  }

  $: groups = (() => {
    console.log('重新计算分组, 当前模式:', groupMode);
    const tabsToGroup = searchQuery ? filteredTabs : tabs;
    
    let groupedTabs = [];
    
    // 只在不分组模式下显示固定标签页分组
    if (groupMode === 'none') {
      const pinnedTabs = tabsToGroup.filter(tab => tab.pinned);
      if (pinnedTabs.length > 0) {
        groupedTabs.push({
          title: '固定标签页',
          tabs: pinnedTabs
        });
      }
      
      const unpinnedTabs = tabsToGroup.filter(tab => !tab.pinned);
      if (unpinnedTabs.length > 0) {
        groupedTabs.push({
          title: '未固定标签页',
          tabs: unpinnedTabs
        });
      }
    } else {
      // 其他分组模式下，保持原有顺序
      switch (groupMode) {
        case 'category':
          const categoryGroups = new Map();
          
          // 按照原有顺序遍历标签页
          tabsToGroup.forEach(tab => {
            const category = tab.predictedCategory || '其他';
            if (!categoryGroups.has(category)) {
              categoryGroups.set(category, {
                title: category,
                tabs: []
              });
            }
            categoryGroups.get(category).tabs.push(tab);
          });
          
          groupedTabs = Array.from(categoryGroups.values());
          break;
          
        case 'domain':
          groupedTabs = tabGroupService.groupByDomain(tabsToGroup);
          break;
          
        case 'time':
          groupedTabs = tabGroupService.groupByLastAccess(tabsToGroup);
          break;
      }
    }
    
    return groupedTabs;
  })();

  // 处理标签页关闭
  async function closeTab(tabId) {
    console.log(`关闭标签页: ${tabId}`);
    try {
      await chrome.tabs.remove(tabId);
      // 实际的移除会通过 onRemoved 事件监听器处理
    } catch (error) {
      console.error('关闭标签页失败:', error);
    }
  }

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

  $: {
    console.log('当前分组模式:', groupMode);
    console.log('搜索关键词:', searchQuery);
    console.log('过滤后的分组:', groups);
  }
</script>
<div class="w-[800px] h-[600px] bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg shadow-lg overflow-hidden">
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
          class="px-4 py-2 rounded-lg transition-colors duration-200 {activeTab === 'memory' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}"
          on:click={() => activeTab = 'memory'}
        >
          内存监控
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
  <main class="bg-white rounded-lg shadow-sm p-4 h-[calc(100%-60px)] overflow-y-auto">
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
          <option value="category">按分类分组</option>
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
                    on:click={() => closeGroup(group)}
                  >
                    关闭此组
                  </button>
                </div>
              {/if}
            </div>
            <div class="divide-y divide-gray-100">
              {#each group.tabs as tab (tab.id)}
                <TabItem
                  {tab}
                  onCategoryChange={handleCategoryChange}
                  {defaultIcon}
                  onActivate={() => activateTab(tab.id)}
                  {showMemory}
                  onTogglePin={() => togglePin(tab)}
                  onClose={() => closeTab(tab.id)}
                />
              {/each}
            </div>
          </div>
        {/each}
      </div>

    {:else if activeTab === 'sessions'}
      <SessionManager />
    {:else if activeTab === 'memory'}
      <MemoryMonitorPage />
    {:else if activeTab === 'settings'}
      <Settings />
    {/if}
  </main>
</div>

<QuickTabSwitcher />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: transparent;
    width: 800px;
    height: 600px;
    overflow: hidden;
  }

  :global(html) {
    width: 800px;
    height: 600px;
    overflow: hidden;
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
