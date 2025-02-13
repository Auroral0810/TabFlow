<script>
  export let show = false;
  export let title = '';
  export let message = '';
  export let onConfirm = () => {};
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- 背景遮罩 -->
    <div class="absolute inset-0 bg-black bg-opacity-30"></div>
    
    <!-- 对话框 -->
    <div class="relative bg-white rounded-lg w-full max-w-md mx-4 p-6">
      <h3 class="text-xl font-bold mb-4">
        {title}
      </h3>
      <p class="text-gray-600 mb-6">
        {message}
      </p>
      <div class="flex justify-center">
        <button
          class="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          on:click={onConfirm}
        >
          确定
        </button>
      </div>
    </div>
  </div>
{/if} 