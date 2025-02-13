<script>
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import AlertDialog from './AlertDialog.svelte';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let editingSession = null; // 新增：用于编辑现有会话
  
  let sessionName = '';
  let tabs = [{ url: '', title: '' }];
  let hasDraft = false;
  
  // 警告对话框状态
  let alertDialog = {
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  };

  // 当编辑现有会话时，加载会话数据
  $: if (editingSession) {
    sessionName = editingSession.name;
    tabs = editingSession.tabs.map(tab => ({
      url: tab.url,
      title: tab.title || ''
    }));
  }

  function formatUrl(url) {
    if (!url) return '';
    
    // 如果已经有协议前缀，直接返回
    if (url.match(/^[a-zA-Z]+:\/\//)) return url;
    
    // 如果是本地文件路径，添加 file:// 前缀
    if (url.match(/^[\/\\]/) || url.match(/^[a-zA-Z]:[\/\\]/)) {
      return `file://${url}`;
    }
    
    // 如果包含端口号或本地主机地址，添加 http://
    if (url.match(/^(localhost|127\.0\.0\.1)(:\d+)?/) || url.match(/:\d+/)) {
      return `http://${url}`;
    }
    
    // 默认添加 https://
    return `https://${url}`;
  }
  
  function addTab() {
    tabs = [...tabs, { url: '', title: '' }];
  }
  
  function removeTab(index) {
    tabs = tabs.filter((_, i) => i !== index);
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
  
  function handleSubmit() {
    // 验证数据
    if (!sessionName.trim()) {
      showAlert('提示', '请输入会话名称');
      return;
    }
    
    // 格式化所有 URL
    const formattedTabs = tabs.map(tab => ({
      ...tab,
      url: formatUrl(tab.url.trim())
    }));
    
    const validTabs = formattedTabs.filter(tab => tab.url);
    if (validTabs.length === 0) {
      showAlert('提示', '请至少添加一个有效的URL');
      return;
    }
    
    // 发送创建/更新事件
    dispatch('save', {
      id: editingSession?.id,
      name: sessionName,
      tabs: validTabs.map(tab => ({
        url: tab.url,
        title: tab.title || tab.url,
        pinned: false
      }))
    });
    
    // 提交成功后静默清除草稿
    clearDraft(false);
    resetForm();
  }
  
  function handleCancel() {
    resetForm();
  }
  
  function resetForm() {
    sessionName = '';
    tabs = [{ url: '', title: '' }];
    editingSession = null;
    show = false;
  }

  // 保存草稿
  async function saveDraft() {
    const draft = {
      name: sessionName,
      tabs: tabs,
      timestamp: Date.now(),
      windowId: (await chrome.windows.getCurrent()).id // 保存当前窗口ID
    };
    localStorage.setItem('session_draft', JSON.stringify(draft));
    showAlert('成功', '草稿已保存');
    hasDraft = true;
  }

  // 加载草稿
  async function loadDraft() {
    const draftJson = localStorage.getItem('session_draft');
    if (draftJson) {
      try {
        const draft = JSON.parse(draftJson);
        // 检查是否是当前窗口的草稿
        const currentWindow = await chrome.windows.getCurrent();
        if (draft.windowId === currentWindow.id) {
          sessionName = draft.name || '';
          tabs = draft.tabs || [{ url: '', title: '' }];
          hasDraft = true;
          return true;
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
    hasDraft = false;
    return false;
  }

  // 清除草稿
  function clearDraft(showNotification = true) {
    localStorage.removeItem('session_draft');
    hasDraft = false;
    sessionName = '';
    tabs = [{ url: '', title: '' }];
    if (showNotification) {
      showAlert('成功', '草稿已清除');
    }
  }

  onMount(async () => {
    if (show && !editingSession) {
      await loadDraft();
    }
  });

  // 每次显示对话框时加载草稿
  $: if (show && !editingSession) {
    loadDraft();
  }
</script>

{#if show}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-2xl">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">新建会话</h2>
        {#if !editingSession}
          <div class="flex space-x-2">
            <button
              on:click={saveDraft}
              class="px-3 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 flex items-center space-x-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <span>保存草稿</span>
            </button>
            {#if hasDraft}
              <button
                on:click={clearDraft}
                class="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center space-x-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>清除草稿</span>
              </button>
            {/if}
          </div>
        {/if}
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          会话名称
        </label>
        <input
          type="text"
          bind:value={sessionName}
          placeholder="输入会话名称"
          class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      
      <div class="space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-medium">标签页列表</h3>
          <button
            on:click={addTab}
            class="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            添加标签页
          </button>
        </div>
        
        {#each tabs as tab, i}
          <div class="flex items-start space-x-2">
            <div class="flex-1 space-y-2">
              <input
                type="text"
                bind:value={tab.url}
                placeholder="URL"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                bind:value={tab.title}
                placeholder="标题（可选）"
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {#if tabs.length > 1}
              <button
                on:click={() => removeTab(i)}
                class="mt-2 px-2 py-1 text-red-600 hover:text-red-700"
              >
                删除
              </button>
            {/if}
          </div>
        {/each}
      </div>
      
      <div class="mt-6 flex justify-end space-x-3">
        <button
          on:click={handleCancel}
          class="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          取消
        </button>
        <button
          on:click={handleSubmit}
          class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {editingSession ? '保存' : '创建'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 添加警告对话框组件 -->
<AlertDialog
  bind:show={alertDialog.show}
  title={alertDialog.title}
  message={alertDialog.message}
  onConfirm={alertDialog.onConfirm}
/> 