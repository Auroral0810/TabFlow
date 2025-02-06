<script>
  import { onMount } from 'svelte';
  import { StorageService } from '../utils/StorageService';
  
  let history = [];
  let searchQuery = '';
  
  onMount(async () => {
    history = await StorageService.getCategoryHistory();
  });
  
  $: filteredHistory = searchQuery
    ? history.filter(entry =>
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;
    
  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="h-full flex flex-col">
  <div class="sticky top-0 bg-white p-4 shadow-sm z-40">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="搜索历史记录..."
      class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>

  <div class="flex-1 overflow-y-auto p-4">
    {#if filteredHistory.length === 0}
      <div class="text-center text-gray-500 py-8">
        暂无历史记录
      </div>
    {:else}
      <div class="space-y-2">
        {#each filteredHistory as entry}
          <div class="border rounded p-3 hover:bg-gray-50">
            <div class="flex items-start justify-between">
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  {#if entry.favIconUrl}
                    <img 
                      src={entry.favIconUrl} 
                      alt="" 
                      class="w-4 h-4"
                      on:error={(e) => e.target.style.display = 'none'}
                    />
                  {/if}
                  <div class="font-medium">{entry.title}</div>
                </div>
                <div class="text-sm text-gray-500">{entry.url}</div>
                <div class="text-sm">
                  分类: <span class="font-medium text-blue-600">{entry.category}</span>
                </div>
              </div>
              <div class="text-xs text-gray-400">
                {formatDate(entry.timestamp)}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div> 