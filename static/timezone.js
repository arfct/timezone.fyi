// Feature 1: If the URL has timezone zones but no time, redirect with the
// browser's current local time prepended. Handles URLs like /PST,EST → /10:30am,PST,EST.
(function () {
  var raw = location.pathname.replace(/^\//, "");
  if (!raw) return;

  var segments = raw.split(/[,.]/);
  // "now" (optionally labelled, e.g. "standup/now") is a live page — never
  // rewrite it to a fixed time.
  if (/^now$/i.test(segments[0])) return;
  // A valid time segment starts with a digit (e.g. "10am", "3:30pm").
  // A label/time segment contains "/" (e.g. "my-meeting/10am").
  // If neither, the URL has no time — prepend current browser time.
  if (!/^\d/.test(segments[0]) && segments[0].indexOf("/") === -1) {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    var timeStr = m === 0 ? h + ampm : h + ":" + String(m).padStart(2, "0") + ampm;
    location.replace("/" + timeStr + "," + segments.join(","));
    return;
  }
})();

// Feature 3: Live pages (/now,cst,pst) — re-render the zones at the top of
// every minute, and right away when the tab becomes visible again.
document.addEventListener("DOMContentLoaded", function () {
  if (!document.body.classList.contains("live")) return;

  function refresh() {
    fetch(location.href, { cache: "no-store" })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var fresh = doc.getElementById("zones");
        var zones = document.getElementById("zones");
        if (fresh && zones) zones.innerHTML = fresh.innerHTML;
        if (doc.title) document.title = doc.title;
      })
      .catch(function () {}); // offline: keep the last render, retry next minute
  }

  function scheduleNextMinute() {
    var ms = 60000 - (Date.now() % 60000) + 250;
    setTimeout(function () {
      if (!document.hidden) refresh();
      scheduleNextMinute();
    }, ms);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });
  scheduleNextMinute();
});

// Feature 2: Calendar modal — show/hide when the cal-btn is clicked.
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("cal-btn");
  var modal = document.getElementById("cal-modal");
  var backdrop = document.getElementById("cal-modal-backdrop");
  var closeBtn = document.getElementById("cal-modal-close");

  if (!btn || !modal) return;

  function openModal() { modal.classList.add("open"); }
  function closeModal() { modal.classList.remove("open"); }

  btn.addEventListener("click", openModal);
  backdrop.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  // Dismiss after choosing an option
  ["cal-opt-gcal", "cal-opt-ics"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("click", function () { setTimeout(closeModal, 150); });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
});
