<script>
  import { onMount, onDestroy } from 'svelte';
  
  let show = false;
  let searchQuery = '';
  let selectedIndex = 0;
  let tabs = [];
  let filteredTabs = [];
  let modalRef;
  
  // 获取操作系统信息
  let isMac = navigator.platform.toLowerCase().includes('mac');
  
  // 快捷键提示
  const modifierKey = isMac ? '⌘' : 'Ctrl';
  
  async function loadTabs() {
    const currentWindow = await chrome.windows.getCurrent();
    tabs = await chrome.tabs.query({ windowId: currentWindow.id });
    filterTabs();
  }
  
  function filterTabs() {
    if (!searchQuery) {
      filteredTabs = tabs;
    } else {
      const query = searchQuery.toLowerCase();
      filteredTabs = tabs.filter(tab => 
        tab.title.toLowerCase().includes(query) || 
        tab.url.toLowerCase().includes(query)
      );
    }
    selectedIndex = 0;
  }
  
  function switchToTab(tab) {
    chrome.tabs.update(tab.id, { active: true });
    closeModal();
  }
  
  function closeModal() {
    show = false;
    searchQuery = '';
  }

  function handleOutsideClick(event) {
    if (modalRef && !modalRef.contains(event.target)) {
      closeModal();
    }
  }
  
  function handleKeydown(event) {
    if (!show) {
      // 只使用 Command/Ctrl + K
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        show = true;
        loadTabs();
        return;
      }
    } else {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          selectedIndex = (selectedIndex + 1) % filteredTabs.length;
          break;
          
        case 'ArrowUp':
          event.preventDefault();
          selectedIndex = (selectedIndex - 1 + filteredTabs.length) % filteredTabs.length;
          break;
          
        case 'Enter':
          event.preventDefault();
          if (filteredTabs[selectedIndex]) {
            switchToTab(filteredTabs[selectedIndex]);
          }
          break;
          
        case 'Escape':
          event.preventDefault();
          closeModal();
          break;
      }
    }
  }
  
  $: filterTabs(searchQuery);
  
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if show}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    on:click={handleOutsideClick}
  >
    <div 
      bind:this={modalRef}
      class="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4"
    >
      <div class="p-4">
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="搜索标签页..."
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-10"
            autofocus
          />
          <svg class="w-5 h-5 absolute left-3 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <div class="mt-2 text-sm text-gray-500">
          按 <span class="inline-block px-2 py-1 bg-gray-100 rounded">{modifierKey}+K</span> 打开快速切换
        </div>
        
        <div class="mt-4 max-h-96 overflow-y-auto">
          {#each filteredTabs as tab, i}
            <div
              class="px-4 py-2 hover:bg-gray-100 cursor-pointer rounded flex items-center space-x-3 {i === selectedIndex ? 'bg-blue-50' : ''}"
              on:click={() => switchToTab(tab)}
            >
              <div class="w-6 h-6 flex-shrink-0 relative mr-2">
                {#if tab.favIconUrl}
                  <div class="w-full h-full flex items-center justify-center">
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      class="w-4 h-4 object-contain transition-all duration-200"
                      style="image-rendering: -webkit-optimize-contrast;"
                      referrerpolicy="no-referrer"
                      crossorigin="anonymous"
                      on:error={(e) => {
                        console.log(`图标加载失败: ${tab.favIconUrl}`);
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
              <div class="flex-1 truncate">
                <div class="font-medium truncate">{tab.title}</div>
                <div class="text-sm text-gray-500 truncate">{tab.url}</div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}