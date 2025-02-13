<script>
  import { onMount } from 'svelte';
  import { MemoryService } from '../utils/MemoryService';
  
  let memoryService = new MemoryService();
  let tabs = [];
  let totalMemoryUsage = 0;
  let searchQuery = '';
  let sortBy = 'memory'; // 'memory' | 'title' | 'lastAccess'
  let sortDirection = 'desc';
  
  async function loadTabs() {
    console.log('Loading tabs...');
    const chromeTabs = await chrome.tabs.query({});
    console.log(`Found ${chromeTabs.length} tabs`);
    
    tabs = await Promise.all(chromeTabs.map(async (tab) => {
      console.log(`Processing tab ${tab.id}: ${tab.title}`);
      await memoryService.updateTabMemoryInfo(tab.id);
      const memoryInfo = memoryService.getTabMemoryStats(tab.id);
      const isHibernated = memoryService.isTabHibernated(tab.id);
      console.log('memoryInfo:', memoryInfo);
      const tabInfo = {
        ...tab,
        memoryInfo,
        isHibernated,
        domain: new URL(tab.url).hostname,
        memoryMB: memoryInfo.totalJS, // 直接使用 memoryInfo.totalJS 作为 memoryMB
        lastAccess: memoryService.lastAccessTimes.get(tab.id) || Date.now()
      };
      
      console.log('Tab info:', {
        id: tab.id,
        title: tab.title,
        memory: `${tabInfo.memoryMB}MB`,
        lastAccess: new Date(tabInfo.lastAccess).toLocaleString()
      });
      console.log('Tab info1111:', tabInfo);
      return tabInfo;
    }));
    
    totalMemoryUsage = tabs.reduce((sum, tab) => sum + (tab.memoryMB || 0), 0);
    console.log(`Total memory usage: ${totalMemoryUsage.toFixed(2)}MB`);
  }
  
  onMount(async () => {
    console.log('MemoryMonitorPage mounted');
    await loadTabs();
    const interval = setInterval(loadTabs, 30000);
    return () => clearInterval(interval);
  });

  // 排序函数
  $: sortedTabs = [...tabs].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'memory':
        return (a.memoryMB - b.memoryMB) * direction;
      case 'title':
        return a.title.localeCompare(b.title) * direction;
      case 'lastAccess':
        return (a.lastAccess - b.lastAccess) * direction;
      default:
        return 0;
    }
  });

  // 搜索过滤
  $: filteredTabs = searchQuery
    ? sortedTabs.filter(tab =>
        tab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.domain.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedTabs;

  function handleSort(field) {
    if (sortBy === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = field;
      sortDirection = 'desc';
    }
  }
  
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  }
  
  async function handleHibernate(tabId) {
    await memoryService.hibernateTab({ id: tabId });
    await loadTabs();
  }
  
  async function handleRestore(tabId) {
    await memoryService.restoreTab(tabId);
    await loadTabs();
  }
</script>

<style>
  .memory-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;  /* 固定表格布局 */
  }

  .memory-table th,
  .memory-table td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #eee;
    overflow: hidden;      /* 溢出隐藏 */
    text-overflow: ellipsis; /* 显示省略号 */
    white-space: nowrap;   /* 不换行 */
  }

  /* 设置各列的固定宽度 */
  .col-title {
    width: 250px;
  }

  .col-domain {
    width: 200px;
  }

  .col-memory {
    width: 100px;
    text-align: right;
  }

  .col-lastAccess {
    width: 150px;
    text-align: center;
  }

  .col-actions {
    width: 80px;
    text-align: center;
  }

  /* 添加鼠标悬停时显示完整内容的提示 */
  .truncate {
    position: relative;
  }

  .truncate:hover::after {
    content: attr(title);
    position: absolute;
    left: 0;
    top: 100%;
    background: #333;
    color: white;
    padding: 5px;
    border-radius: 3px;
    z-index: 1000;
    max-width: 300px;
    word-wrap: break-word;
    white-space: normal;
  }
</style>

<div class="p-4 space-y-4">
  <div class="flex justify-between items-center">
    <h2 class="text-xl font-medium">内存监控</h2>
    <div class="text-gray-600">
      总内存使用: {totalMemoryUsage.toFixed(2)} MB
    </div>
  </div>
  
  <div class="flex space-x-4 items-center">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="搜索标签页..."
      class="px-3 py-2 border rounded-lg flex-1"
    />
    
    <select
      bind:value={sortBy}
      class="px-3 py-2 border rounded-lg"
    >
      <option value="memory">按内存排序</option>
      <option value="title">按标题排序</option>
      <option value="lastAccess">按访问时间排序</option>
    </select>
  </div>
  
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="memory-table">
      <colgroup>
        <col class="col-title">
        <col class="col-domain">
        <col class="col-memory">
        <col class="col-lastAccess">
        <col class="col-actions">
      </colgroup>
      <thead class="bg-gray-50">
        <tr>
          <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">
            标签页
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">
            域名
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium text-gray-500 cursor-pointer"
              on:click={() => handleSort('memory')}>
            内存使用
            {#if sortBy === 'memory'}
              {sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium text-gray-500 cursor-pointer"
              on:click={() => handleSort('lastAccess')}>
            最后访问
            {#if sortBy === 'lastAccess'}
              {sortDirection === 'asc' ? '↑' : '↓'}
            {/if}
          </th>
          <th class="px-4 py-2 text-left text-sm font-medium text-gray-500">
            操作
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        {#each filteredTabs as tab}
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-2 truncate" title={tab.title}>
              <div class="flex items-center space-x-2">
                <img
                  src={tab.favIconUrl}
                  alt=""
                  class="w-4 h-4"
                  on:error={(e) => {
                    e.target.style.display = 'none';
                    // 可选：使用默认图标替代
                    // e.target.src = 'path/to/default/icon.png';
                  }}
                />
                <span class="truncate max-w-md" title={tab.title}>
                  {tab.title}
                </span>
              </div>
            </td>
            <td class="px-4 py-2 truncate" title={tab.url}>
              {tab.domain}
            </td>
            <td class="px-4 py-2">
              <span class={tab.memoryMB > 200 ? 'text-red-500 font-medium' : ''}>
                {tab.memoryMB} MB
              </span>
            </td>
            <td class="px-4 py-2 text-sm text-gray-500">
              {formatTime(tab.lastAccess)}
            </td>
            <td class="px-4 py-2">
              {#if tab.isHibernated}
                <button
                  on:click={() => handleRestore(tab.id)}
                  class="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                >
                  恢复
                </button>
              {:else}
                <button
                  on:click={() => handleHibernate(tab.id)}
                  class="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                >
                  休眠
                </button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  
  <div class="mt-4 p-4 bg-yellow-50 rounded-lg">
    <h3 class="font-medium mb-2">内存使用说明</h3>
    <ul class="text-sm text-gray-600 space-y-1">
      <li>• 内存使用超过200MB的标签页会以红色显示</li>
      <li>• 数据每30秒自动更新一次</li>
      <li>• 点击表头可以按照不同列进行排序</li>
      <li>• 可以通过搜索框筛选标签页</li>
    </ul>
  </div>
</div> 