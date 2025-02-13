<script>
  import { onMount } from 'svelte';
  import { SessionService } from '../utils/SessionService';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import AlertDialog from './AlertDialog.svelte';
  import CreateSessionDialog from './CreateSessionDialog.svelte';
  
  let sessionService = new SessionService();
  let sessions = [];
  let sessionName = '';
  let editingSession = null;
  let showConfirmDelete = false;
  let sessionToDelete = null;
  let showSessionDetail = null;
  let editingTab = null;
  let newTabUrl = '';
  let newTabTitle = '';
  let isLoggedIn = false;
  let showCreateDialog = false;
  
  // 确认对话框状态
  let confirmDialog = {
    show: false,
    title: '',
    message: '',
    confirmText: '确定',
    confirmButtonClass: '',
    onConfirm: () => {},
    onCancel: () => {}
  };

  // 编辑状态管理
  let editingState = {
    sessionId: null,
    tabIndex: null,
    newUrl: ''
  };

  // 警告对话框状态
  let alertDialog = {
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  };

  onMount(async () => {
    sessions = await sessionService.getSessions();
  });
  
  async function saveCurrentSession() {
    if (!sessionName.trim()) {
      alert('请输入会话名称');
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      await sessionService.saveSession(sessionName, tabs);
      sessions = await sessionService.getSessions();
      sessionName = '';
    } catch (error) {
      console.error('保存会话失败:', error);
      alert('保存会话失败');
    }
  }
  
  async function restoreSession(sessionId) {
    try {
      await sessionService.restoreSession(sessionId);
    } catch (error) {
      console.error('恢复会话失败:', error);
      alert('恢复会话失败');
    }
  }
  
  async function deleteSession(sessionId) {
    try {
      await sessionService.deleteSession(sessionId);
      sessions = await sessionService.getSessions();
      showConfirmDelete = false;
      sessionToDelete = null;
    } catch (error) {
      console.error('删除会话失败:', error);
      alert('删除会话失败');
    }
  }

  async function updateSessionName(sessionId, newName) {
    if (!newName.trim()) {
      alert('会话名称不能为空');
      return;
    }

    try {
      await sessionService.updateSession(sessionId, { name: newName });
      sessions = await sessionService.getSessions();
      editingSession = null;
    } catch (error) {
      console.error('更新会话失败:', error);
      alert('更新会话失败');
    }
  }

  function showConfirm(options) {
    confirmDialog = {
      show: true,
      confirmText: '确定',
      confirmButtonClass: 'bg-blue-500 hover:bg-blue-600',
      ...options,
      onCancel: () => {
        confirmDialog.show = false;
        options.onCancel?.();
      }
    };
  }

  // 开始编辑标签页
  function startEditing(session, tabIndex) {
    const tab = session.tabs[tabIndex];
    editingTab = `${session.id}-${tabIndex}`;
    editingState = {
      sessionId: session.id,
      tabIndex: tabIndex,
      newUrl: tab.url // 设置初始值为原始 URL
    };
  }

  // 删除标签页
  function handleDeleteTab(sessionId, tabIndex) {
    showConfirm({
      title: '删除标签页',
      message: '确认要删除这个标签页吗？',
      confirmText: '确定',
      confirmButtonClass: 'bg-blue-500 hover:bg-blue-600',
      onConfirm: async () => {
        await deleteTab(sessionId, tabIndex);
        confirmDialog.show = false;
      }
    });
  }

  // 删除会话
  function handleDeleteSession(sessionId) {
    showConfirm({
      title: '确认删除',
      message: '确定要删除这个会话吗？此操作无法撤销。',
      confirmText: '删除',
      confirmButtonClass: 'bg-red-500 hover:bg-red-600',
      onConfirm: async () => {
        await deleteSession(sessionId);
        confirmDialog.show = false;
      }
    });
  }

  // 保存会话
  async function handleSaveSession(event) {
    const { id, name, tabs } = event.detail;
    try {
      if (id) {
        // 更新现有会话
        await sessionService.updateSession(id, { name, tabs });
      } else {
        // 创建新会话
        await sessionService.saveSession(name, tabs);
      }
      
      sessions = await sessionService.getSessions();
      showAlert('成功', id ? '会话已更新' : '新会话已创建');
      
      // 清除草稿
      localStorage.removeItem('session_draft');
    } catch (error) {
      console.error('保存会话失败:', error);
      showAlert('失败', error.message);
    }
  }

  function handleEditSession(session) {
    editingSession = session;
    showCreateDialog = true;
  }

  // 添加新标签页
  function handleAddTab(sessionId) {
    if (!newTabUrl.trim()) {
      showAlert('添加标签页', '请输入URL');
      return;
    }

    showConfirm({
      title: '添加标签页',
      message: '确定要添加这个新标签页吗？',
      confirmText: '添加',
      confirmButtonClass: 'bg-green-500 hover:bg-green-600',
      onConfirm: async () => {
        await addTab(sessionId);
        confirmDialog.show = false;
      }
    });
  }

  // 更新标签页
  function handleUpdateTab(sessionId, tabIndex, newUrl) {
    if (!newUrl.trim()) {
      showAlert('更新标签页', '请输入URL');
      return;
    }

    showConfirm({
      title: '更新标签页',
      message: '确定要保存修改吗？',
      confirmText: '保存',
      confirmButtonClass: 'bg-blue-500 hover:bg-blue-600',
      onConfirm: async () => {
        await updateTab(sessionId, tabIndex, { url: newUrl });
        confirmDialog.show = false;
        editingTab = null;
      }
    });
  }

  async function updateTab(sessionId, tabIndex, updates) {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const updatedTabs = [...session.tabs];
      updatedTabs[tabIndex] = { ...updatedTabs[tabIndex], ...updates };

      await sessionService.updateSession(sessionId, { tabs: updatedTabs });
      sessions = await sessionService.getSessions();
      editingTab = null;
    } catch (error) {
      console.error('更新标签页失败:', error);
      alert('更新标签页失败');
    }
  }

  // 新增：删除标签页
  async function deleteTab(sessionId, tabIndex) {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const updatedTabs = session.tabs.filter((_, i) => i !== tabIndex);
      await sessionService.updateSession(sessionId, { tabs: updatedTabs });
      sessions = await sessionService.getSessions();
    } catch (error) {
      console.error('删除标签页失败:', error);
      alert('删除标签页失败');
    }
  }

  // 新增：添加标签页
  async function addTab(sessionId) {
    if (!newTabUrl.trim()) {
      alert('请输入URL');
      return;
    }

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      const newTab = {
        url: newTabUrl,
        title: newTabTitle || newTabUrl,
        pinned: false
      };

      const updatedTabs = [...session.tabs, newTab];
      await sessionService.updateSession(sessionId, { tabs: updatedTabs });
      sessions = await sessionService.getSessions();
      newTabUrl = '';
      newTabTitle = '';
    } catch (error) {
      console.error('添加标签页失败:', error);
      alert('添加标签页失败');
    }
  }

  function showAlert(title, message) {
    alertDialog = {
      show: true,
      title,
      message,
      onConfirm: () => {
        alertDialog.show = false;
      }
    };
  }

  // 修改验证逻辑
  function validateUrl(url) {
    if (!url?.trim()) {
      showAlert('提示', '请输入URL');
      return false;
    }
    return true;
  }

  async function handleSync() {
    try {
      if (!isLoggedIn) {
        await sessionService.signIn();
        isLoggedIn = true;
      }
      await sessionService.syncToCloud();
      showAlert('同步成功', '数据已成功同步到云端');
    } catch (error) {
      console.error('同步失败:', error);
      showAlert('同步失败', error.message);
    }
  }

  async function handleCreateSession(event) {
    const { name, tabs } = event.detail;
    try {
      await sessionService.saveSession(name, tabs);
      sessions = await sessionService.getSessions();
      showAlert('创建成功', '新会话已创建');
    } catch (error) {
      console.error('创建会话失败:', error);
      showAlert('创建失败', error.message);
    }
  }
</script>

<div class="h-full flex flex-col">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">会话管理</h2>
    <div class="flex space-x-2">
      <button
        on:click={() => {
          editingSession = null;
          showCreateDialog = true;
        }}
        class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        新建会话
      </button>
      <button
        on:click={handleSync}
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        {isLoggedIn ? '同步' : '登录并同步'}
      </button>
    </div>
  </div>
  <div class="bg-white rounded-lg shadow-sm p-4 flex-1 overflow-auto">
    <div class="p-4">
      <div class="mb-4 flex items-center">
        <input
          type="text"
          bind:value={sessionName}
          placeholder="输入会话名称"
          class="px-3 py-2 border rounded-lg mr-2 flex-1"
        />
        <button
          on:click={() => {
            editingSession = null;
            showCreateDialog = true;
          }}
          class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          保存当前会话
        </button>
      </div>
      
      <div class="space-y-4">
        {#each sessions as session}
          <div class="border rounded-lg p-4 hover:shadow-sm transition-shadow">
            <div class="flex justify-between items-center mb-2">
              {#if editingSession === session.id}
                <input
                  type="text"
                  value={session.name}
                  class="px-2 py-1 border rounded"
                  on:keydown={(e) => {
                    if (e.key === 'Enter') {
                      if (confirm('确认要修改会话名称吗？')) {
                        updateSessionName(session.id, e.target.value);
                      }
                    } else if (e.key === 'Escape') {
                      editingSession = null;
                    }
                  }}
                  on:blur={(e) => {
                    if (confirm('确认要修改会话名称吗？')) {
                      updateSessionName(session.id, e.target.value);
                    }
                  }}
                />
              {:else}
                <h3 class="font-medium flex items-center">
                  {session.name}
                  <button
                    class="ml-2 text-gray-400 hover:text-gray-600"
                    on:click={() => handleEditSession(session)}
                    title="编辑名称"
                  >
                    ✎
                  </button>
                </h3>
              {/if}
              
              <div class="flex items-center space-x-2">
                <button
                  on:click={() => {
                    if (showSessionDetail === session.id) {
                      showSessionDetail = null;
                    } else {
                      showSessionDetail = session.id;
                    }
                  }}
                  class="px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                >
                  {showSessionDetail === session.id ? '收起' : '展开'}
                </button>
                <button
                  on:click={() => restoreSession(session.id)}
                  class="px-3 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                >
                  恢复会话
                </button>
                <button
                  on:click={() => handleDeleteSession(session.id)}
                  class="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                >
                  删除
                </button>
              </div>
            </div>
            
            <div class="text-sm text-gray-500 mb-2">
              {session.tabs.length} 个标签页 · 
              {new Date(session.timestamp).toLocaleString()}
            </div>

            {#if showSessionDetail === session.id}
              <div class="mt-4 space-y-2">
                {#each session.tabs as tab, i}
                  <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                    {#if editingTab === `${session.id}-${i}`}
                      <div class="flex-1 mr-2 max-w-2xl">
                        <input
                          type="text"
                          bind:value={editingState.newUrl}
                          class="w-full px-2 py-1 border rounded"
                          placeholder="URL"
                          on:keydown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateTab(session.id, i, editingState.newUrl);
                            } else if (e.key === 'Escape') {
                              editingTab = null;
                            }
                          }}
                        />
                      </div>
                      <div class="flex items-center space-x-2">
                        <button
                          on:click={() => handleUpdateTab(session.id, i, editingState.newUrl)}
                          class="text-blue-500 hover:text-blue-600"
                        >
                          保存
                        </button>
                        <button
                          on:click={() => editingTab = null}
                          class="text-gray-500 hover:text-gray-600"
                        >
                          取消
                        </button>
                      </div>
                    {:else}
                      <div class="flex-1 max-w-2xl overflow-hidden">
                        <div class="font-medium truncate">{tab.title || '无标题'}</div>
                        <div class="text-sm text-gray-500 truncate">{tab.url}</div>
                      </div>
                      <div class="flex items-center space-x-2 ml-2">
                        <button
                          on:click={() => startEditing(session, i)}
                          class="text-gray-400 hover:text-gray-600"
                        >
                          编辑
                        </button>
                        <button
                          on:click={() => handleDeleteTab(session.id, i)}
                          class="text-red-400 hover:text-red-600"
                        >
                          删除
                        </button>
                      </div>
                    {/if}
                  </div>
                {/each}

                <div class="mt-4 p-2 border-t">
                  <div class="flex items-end space-x-2">
                    <div class="flex-1 max-w-2xl">
                      <input
                        type="text"
                        bind:value={newTabUrl}
                        placeholder="输入新标签页URL"
                        class="w-full px-2 py-1 border rounded"
                      />
                    </div>
                    <button
                      on:click={() => handleAddTab(session.id)}
                      class="px-3 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                    >
                      添加
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <CreateSessionDialog
    bind:show={showCreateDialog}
    bind:editingSession
    on:save={handleSaveSession}
  />
</div>

<!-- 添加警告对话框组件 -->
<AlertDialog
  bind:show={alertDialog.show}
  title={alertDialog.title}
  message={alertDialog.message}
  onConfirm={alertDialog.onConfirm}
/>

<ConfirmDialog
  bind:show={confirmDialog.show}
  title={confirmDialog.title}
  message={confirmDialog.message}
  confirmText={confirmDialog.confirmText}
  confirmButtonClass={confirmDialog.confirmButtonClass}
  onConfirm={confirmDialog.onConfirm}
  onCancel={confirmDialog.onCancel}
/>