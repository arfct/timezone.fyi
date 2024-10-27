<script>
	import { onMount } from "svelte";
  import TimezoneView from "$lib/TimezoneView.svelte";
  import { getZoneInfo } from "$lib/timezones";

  export let data;
  let timezones = [];

  $: {
    const path = data.tzstring;
    const infos = getZoneInfo(path);
    if (infos) {
      timezones = infos.zones;
    }
  }

  onMount(() => {
    const path = data.tzstring;
    const infos = getZoneInfo(path);
    if (infos) {
      timezones = infos.zones;
    }
  });

</script>

<div class="flex flex-row h-screen w-full">
{#each timezones as timezone}
  <TimezoneView timezone={timezone} />
{/each}
</div>


