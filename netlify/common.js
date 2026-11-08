import * as tc from "timezonecomplete";
import tzdata from "tzdata";
import { resolveCodes } from "./zone-lookup.js";
import { dayOffset as getDayOffset, formatDayOffset } from "./day-offset.js";

// Use the top-level tzdata package, which Dependabot keeps current, instead of
// the older copy that timezonecomplete pins and would load on its own.
tc.TzDatabase.init(tzdata);

// in: one value from resolveCodes()
// out: an argument for tc.zone()
function toTcZone(z) {
  if (typeof z === 'number') {
    // If z is solely a number, assume it is GMT offset in hours, convert to minutes, and return it directly.
    return z * 60;
  }

  let gmtmatch = z
    .toString()
    .toUpperCase()
    .match(/^GMT([+\-]\d+)$/);
  console.log("gmtmatch", gmtmatch, z);
  
  if (gmtmatch && gmtmatch[1]) {
    z = gmtmatch[1];

    let tzd = tc.TzDatabase.instance();

    if (!tzd.exists(z)) {
      // Uppercase for country names
      z = z[0].toUpperCase() + z.substring(1);
    }
  }

  return z;
}

function decodePrettyComponent(s) {
  let replacements = { "---": " - ", "--": "-", "-": " " };
  return decodeURIComponent(s.replace(/-+/g, (e) => replacements[e] ?? "-"));
}

var hourMoji = [
  "🕛",
  "🕐",
  "🕑",
  "🕒",
  "🕓",
  "🕔",
  "🕕",
  "🕖",
  "🕗",
  "🕘",
  "🕙",
  "🕚",
];
var halfHourMoji = [
  "🕧",
  "🕜",
  "🕝",
  "🕞",
  "🕟",
  "🕠",
  "🕡",
  "🕢",
  "🕣",
  "🕤",
  "🕥",
  "🕦",
  "🕧",
];

export const colors = [
  "#012459",
  "#001322",
  "#003972",
  "#001322",
  "#003972",
  "#001322",
  "#004372",
  "#00182b",
  "#004372",
  "#011d34",
  "#016792",
  "#00182b",
  "#07729f",
  "#042c47",
  "#12a1c0",
  "#07506e",
  "#74d4cc",
  "#1386a6",
  "#efeebc",
  "#61d0cf",
  "#fee154",
  "#a3dec6",
  "#fdc352",
  "#e8ed92",
  "#ffac6f",
  "#ffe467",
  "#fda65a",
  "#ffe467",
  "#fd9e58",
  "#ffe467",
  "#f18448",
  "#ffd364",
  "#f06b7e",
  "#f9a856",
  "#ca5a92",
  "#f4896b",
  "#5b2c83",
  "#d1628b",
  "#371a79",
  "#713684",
  "#28166b",
  "#45217c",
  "#192861",
  "#372074",
  "#040b3c",
  "#233072",
  "#040b3c",
  "#012459",
];

export const getZoneInfo = (path) => {
  var error;
  var info = undefined;
  var zones = path.replace(/ /g, "+").split(/[,.]/);

  if (zones.length > 1) {
    try {
      var timeString = decodeURIComponent(zones.shift());

      // "now" in place of a time (e.g. /now,cst,pst or /standup/now,cst,pst)
      // renders the current minute; the page keeps itself up to date.
      var zoneNames = resolveCodes(zones).map(toTcZone);
      var firstZone = zoneNames[0];
      var label, start, end, live;
      var nowMatch = timeString.match(/^\/?(?:(?<label>[^\/]+)\/)?now$/i);
      if (nowMatch) {
        live = true;
        label = nowMatch.groups.label;
        if (label) label = decodePrettyComponent(label);
        var current = tc.now(tc.zone(firstZone));
        start = current
          .sub(tc.seconds(current.second()))
          .sub(tc.milliseconds(current.millisecond()));
      } else {
        // Handle difference in params[0] on local vs server (firebase) looking at leading slash
        var timeRE =
          /\/?(?<label>[^\/]+\/)?(?<h1>\d?\d):?(?<m1>\d\d)?(?<p1>[aph])?m?-?(?<h2>\d?\d)?:?(?<m2>\d\d)?(?<p2>[aph])?m?/;
        var match = timeString.match(timeRE);
        if (!match) return { error: `Could not parse time from: ${timeString}` };
        var groups = match.groups;

        label = groups.label;
        if (label) label = decodePrettyComponent(label.slice(0, -1));

        start = new tc.now(tc.zone(firstZone))
          .startOfDay()
          .add(tc.hours(parseInt(groups.h1)))
          .add(tc.minutes(parseInt(groups.m1) || 0));

        if (groups.p1 == "p" && start.hour() < 12)
          start = start.add(tc.hours(12));
        if (groups.h2) {
          end = new tc.now(tc.zone(firstZone))
            .startOfDay()
            .add(tc.hours(parseInt(groups.h2)))
            .add(tc.minutes(parseInt(groups.m2) || 0));
          if ((groups.p2 == "p" && end.hour() < 12) || start.hour() > end.hour())
            end = end.add(tc.hours(12));
        }
      }

      let duration = end ? end.diff(start).minutes() : undefined;
      info = { zones: [], label, start, end, duration, live };
      zones.forEach((zone, i) => {
        var tzName = zoneNames[i];
        if (zone.length) {
          var z = (zoneInfo = {});
          var tcz = tc.zone(tzName);

          var zoneStart = start.toZone(tcz);
          var dayOffset = getDayOffset(start, zoneStart);

          let omitXM = false;
          var endString = "";
          if (end) {
            var zoneEnd = end.toZone(tcz);
            endString = zoneEnd
              .format("h:mm a")
              .replace(" PM", "ᴘᴍ")
              .replace(" AM", "ᴀᴍ")
              .replace(":00", "");

            // omitXM = (zoneEnd.hour() < 12 && zoneStart.hour() < 12) || zoneEnd.hour() >= 12 && zoneStart.hour() >= 12
          }

          var startString = zoneStart
            .format(omitXM ? "h:mm" : "h:mm a")
            .replace(" PM", "ᴘᴍ")
            .replace(" AM", "ᴀᴍ")
            .replace(":00", "");

          var emoji = hourMoji[zoneStart.hour() % 12];
          var niceZoneName = zone
            .split("/")
            .pop()
            .replace(/_/g, " ")
            .toUpperCase();

          var dayMarker = formatDayOffset(dayOffset);
          var description = `${startString}${
            endString ? "‑" + endString : ""
          } ${niceZoneName}${dayMarker ? " " + dayMarker : ""}`;
          var night =
            zoneStart.hour() > 14 || zoneStart.hour() <= 6 ? "night" : "";
          var zoneInfo = {
            description,
            night,
            zoneStart,
            zoneEnd,
            emoji,
            niceZoneName,
            startString,
            endString,
            dayOffset,
          };
          info.zones.push(zoneInfo);
        }
      });
    } catch (e) {
      return { error: e.message };
    }

    return info;
  }
  return undefined;
};
