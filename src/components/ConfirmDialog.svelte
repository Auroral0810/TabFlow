<script>
  export let show = false;
  export let title = '';
  export let message = '';
  export let onConfirm = () => {};
  export let onCancel = () => {};
  export let confirmText = '删除';
  export let confirmButtonClass = 'bg-red-500 hover:bg-red-600';
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- 背景遮罩 -->
    <div 
      class="absolute inset-0 bg-black bg-opacity-30"
      role="button"
      tabindex="0"
      on:click={onCancel}
      on:keydown={e => e.key === 'Escape' && onCancel()}
    ></div>
    
    <!-- 对话框 -->
    <div class="relative bg-white rounded-lg w-full max-w-md mx-4 p-6">
      <h3 class="text-xl font-bold mb-4">
        {title}
      </h3>
      <p class="text-gray-600 mb-6">
        {message}
      </p>
      <div class="flex justify-end space-x-4">
        <button
          class="px-6 py-2 text-gray-600 hover:text-gray-800 rounded"
          on:click={onCancel}
        >
          取消
        </button>
        <button
          class="px-6 py-2 text-white rounded transition-colors {confirmButtonClass}"
          on:click={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if} 