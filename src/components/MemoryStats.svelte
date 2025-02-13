<script>
  import { onMount } from 'svelte';
  import { MemoryService } from '../utils/MemoryService';
  
  export let tabId;
  
  let memoryService = new MemoryService();
  let memoryInfo = null;
  let interval;
  
  onMount(() => {
    // 初始获取内存信息
    updateMemoryInfo();
    
    // 每30秒更新一次内存信息
    interval = setInterval(updateMemoryInfo, 10000);
    
    return () => {
      clearInterval(interval);
    };
  });
  
  async function updateMemoryInfo() {
    const info = await memoryService.getTabMemoryStats(tabId);
    if (info) {
      memoryInfo = {
        ...info,
        privateMemoryMB: Math.round(info.privateMemory / (1024 * 1024)),
        jsMemoryMB: Math.round(info.jsMemoryAllocated / (1024 * 1024))
      };
    }
  }
</script>

{#if memoryInfo}
  <div class="text-xs text-gray-500">
    内存占用: {memoryInfo.privateMemoryMB}MB
    {#if memoryInfo.privateMemoryMB > 100}
      <span class="text-red-500 ml-1">
        (偏高)
      </span>
    {/if}
  </div>
{:else}
  <div class="text-xs text-gray-400">
    计算中...
  </div>
{/if} 