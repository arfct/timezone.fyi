<script>
	import { onMount } from "svelte";
  import TimezoneView from "$lib/TimezoneView.svelte";
  import { getZoneInfo } from "$lib/timezones";

	/** @type {import('./$types').PageData} */
  export let data;
  let description = 'timezone.fyi'
  let timezones = [];
  let path = ''

  $: {
    path = data.tzstring;
    const infos = getZoneInfo(path);
    if (infos) {
      timezones = infos.zones;
    }
  }

  onMount(() => {
    console.log(data.url);
    path = data.tzstring;
    const infos = getZoneInfo(path);
    if (infos) {
      timezones = infos.zones;
    }
  });

</script>

<svelte:head>
  <meta property="og:title" content="{description}">
  <meta property="og:description" content="{description}">
  {#if timezones.length > 0}
    <meta property="og:image" content="{data.url.origin}/og?path={path}">
  {/if}
  <meta property="og:type" content="website">
</svelte:head>

<div class="flex flex-row h-screen w-full">
{#each timezones as timezone}
  <TimezoneView timezone={timezone} />
{/each}
</div>


