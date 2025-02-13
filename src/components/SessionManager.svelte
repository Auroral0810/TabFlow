<script>
  import { onMount } from 'svelte';
  import { SessionService } from '../utils/SessionService';
  
  let sessionService = new SessionService();
  let sessions = [];
  let sessionName = '';
  
  onMount(async () => {
    sessions = await sessionService.getSessions();
  });
  
  async function saveCurrentSession() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    await sessionService.saveSession(sessionName, tabs);
    sessions = await sessionService.getSessions();
    sessionName = '';
  }
  
  async function restoreSession(sessionId) {
    await sessionService.restoreSession(sessionId);
  }
  
  async function syncSessions() {
    await sessionService.syncWithFirebase();
    sessions = await sessionService.getSessions();
  }
</script>

<div class="h-full flex flex-col">
  <h2 class="text-xl font-medium text-gray-700 mb-4">会话管理</h2>
  <div class="bg-white rounded-lg shadow-sm p-4 flex-1">
    <div class="p-4">
      <div class="mb-4">
        <input
          type="text"
          bind:value={sessionName}
          placeholder="输入会话名称"
          class="px-3 py-2 border rounded-lg mr-2"
        />
        <button
          on:click={saveCurrentSession}
          class="px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          保存当前会话
        </button>
        <button
          on:click={syncSessions}
          class="ml-2 px-4 py-2 bg-green-500 text-white rounded-lg"
        >
          同步会话
        </button>
      </div>
      
      <div class="space-y-2">
        {#each sessions as session}
          <div class="border rounded-lg p-4">
            <div class="flex justify-between items-center">
              <h3 class="font-medium">{session.name}</h3>
              <button
                on:click={() => restoreSession(session.id)}
                class="px-3 py-1 bg-blue-100 text-blue-600 rounded"
              >
                恢复会话
              </button>
            </div>
            <div class="mt-2 text-sm text-gray-500">
              {session.tabs.length} 个标签页 · 
              {new Date(session.timestamp).toLocaleString()}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>