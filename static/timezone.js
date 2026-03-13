// Feature 1: If the URL has timezone zones but no time, redirect with the
// browser's current local time prepended. Handles URLs like /PST,EST → /10:30am,PST,EST.
(function () {
  var raw = location.pathname.replace(/^\//, "");
  if (!raw) return;

  var segments = raw.split(/[,.]/);
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

// Feature 2: Calendar modal — show/hide when the cal-btn is clicked.
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("cal-btn");
  var modal = document.getElementById("cal-modal");
  var backdrop = document.getElementById("cal-modal-backdrop");

  if (!btn || !modal) return;

  btn.addEventListener("click", function () {
    modal.classList.add("open");
  });

  backdrop.addEventListener("click", function () {
    modal.classList.remove("open");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") modal.classList.remove("open");
  });
});
