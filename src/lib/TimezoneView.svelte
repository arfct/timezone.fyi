<script>
  export let timezone;
</script>

<div class={`zone ${timezone.night ? "night" : ""} g${timezone.zoneStart.hour}`}>
  <div class="emoji">{timezone.emoji}</div>
  <div class="timezone">
    <div class="nicezone">{timezone.niceZoneName}</div>
    <div class="actualzone">{timezone.zoneStart.timezone}</div>
  </div>
  <div class="time">
    {timezone.startString}
    {timezone.extraDay ? "⁺¹" : ""}
    {#if timezone.endString }
    <div class="dash">–</div>
    {/if}
    {timezone.endString}
  </div>
</div>