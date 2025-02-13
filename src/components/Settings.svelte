<script>
  // 设置的占位组件
  import { IntegrationService } from '../utils/IntegrationService';
  import { MemoryService } from '../utils/MemoryService';
  
  let integrationService = new IntegrationService();
  let notionToken = '';
  let trelloKey = '';
  let trelloToken = '';
  
  let memoryService = new MemoryService();
  let memoryThreshold = 100; // 默认100MB
  let autoHibernateEnabled = true;
  
  async function saveIntegrationSettings() {
    await integrationService.initializeNotion(notionToken);
    await integrationService.initializeTrello(trelloKey, trelloToken);
  }
  
  function updateMemorySettings() {
    memoryService.setMemoryThreshold(memoryThreshold);
    memoryService.setAutoHibernate(autoHibernateEnabled);
  }
</script>

<div class="h-full flex flex-col">
  <h2 class="text-xl font-medium text-gray-700 mb-4">设置</h2>
  <div class="bg-white rounded-lg shadow-sm p-4 flex-1">
    <p class="text-gray-500">设置功能开发中...</p>
  </div>
</div>

<div class="p-4">
  <h2 class="text-xl font-medium mb-4">集成设置</h2>
  
  <div class="space-y-4">
    <div>
      <h3 class="font-medium mb-2">Notion 集成</h3>
      <input
        type="text"
        bind:value={notionToken}
        placeholder="输入 Notion API Token"
        class="w-full px-3 py-2 border rounded-lg"
      />
    </div>
    
    <div>
      <h3 class="font-medium mb-2">Trello 集成</h3>
      <input
        type="text"
        bind:value={trelloKey}
        placeholder="输入 Trello API Key"
        class="w-full px-3 py-2 border rounded-lg mb-2"
      />
      <input
        type="text"
        bind:value={trelloToken}
        placeholder="输入 Trello Token"
        class="w-full px-3 py-2 border rounded-lg"
      />
    </div>
    
    <button
      on:click={saveIntegrationSettings}
      class="px-4 py-2 bg-blue-500 text-white rounded-lg"
    >
      保存设置
    </button>
  </div>
</div>