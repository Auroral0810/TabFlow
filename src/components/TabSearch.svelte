<script>
  import { createEventDispatcher } from 'svelte';
  
  export let searchQuery = '';
  const dispatch = createEventDispatcher();
  
  let focused = false;
  let searchTimeout;

  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      dispatch('search', { query: searchQuery });
    }, 300);
  }

  function clearSearch() {
    searchQuery = '';
    dispatch('search', { query: '' });
  }
</script>

<div class="relative flex items-center">
  <div class="relative">
    <input
      type="text"
      placeholder="搜索标签页..."
      class="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      bind:value={searchQuery}
      on:input={handleSearch}
      on:focus={() => focused = true}
      on:blur={() => focused = false}
    />
    <svg
      class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
    {#if searchQuery}
      <button
        class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        on:click={clearSearch}
      >
        ×
      </button>
    {/if}
  </div>
</div>