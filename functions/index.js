const functions = require('firebase-functions');
// const moment = require('moment-timezone');
const dayjs = require('dayjs')
var utc = require('dayjs/plugin/utc') // dependent on utc plugin
var timezone = require('dayjs/plugin/timezone')
var customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

var overrides = {
  GMT: 0,
  EDT: "America/New_York",
  EST: "America/New_York",
  ET: "America/New_York",
  CT: "America/Chicago",
  CDT: "America/Chicago",
  CST: "America/Chicago",
  MDT: "America/Denver",
  MST: "America/Denver",
  PDT: "America/Los_Angeles",
  PST: "America/Los_Angeles",
  PT: "America/Los_Angeles",
  LON: "Europe/London",
  NYC: "America/New_York",
  BOS: "America/New_York",
  CAM: "America/New_York",
  SF: "America/Los_Angeles",
  SEA: "America/Los_Angeles",
  MTV: "America/Los_Angeles",
  MPO: "America/Los_Angeles",
  TOK: "Asia/Tokyo",
  ZRH: "Europe/Zurich",
  KST: "Asia/Seoul",
  KDT: "Asia/Seoul",
  "CGK":"Asia/Jakarta", "DFW":"America/Chicago", "ATL":"America/New_York", "DEN":"America/Denver", "DEL":"Asia/Kolkata", "ORD":"America/Chicago", "CAN":"Asia/Shanghai", "CLT":"America/New_York", "HND":"Asia/Tokyo", "KMG":"Asia/Shanghai", "CKG":"Asia/Shanghai", "PEK":"Asia/Shanghai", "XIY":"Asia/Shanghai", "SZX":"Asia/Shanghai", "CTU":"Asia/Shanghai", "PVG":"Asia/Shanghai", "SEA":"America/Los_Angeles", "MEX":"America/Mexico_City", "SHA":"Asia/Shanghai", "YYZ":"America/Toronto", "BOM":"Asia/Kolkata", "HGH":"Asia/Shanghai", "LAX":"America/Los_Angeles", "LHR":"Europe/London", "AMS":"Europe/Amsterdam", "PHX":"America/Phoenix", "BLR":"Asia/Kolkata", "NKG":"Asia/Shanghai", "PKX":"Asia/Shanghai", "IAH":"America/Chicago", "LAS":"America/Los_Angeles", "IST":"Europe/Istanbul", "MSP":"America/Chicago", "SVO":"Europe/Moscow", "CGO":"Asia/Shanghai", "CSX":"Asia/Shanghai", "DTW":"America/Detroit", "DMK":"Asia/Bangkok", "CDG":"Europe/Paris", "SLC":"America/Denver", "MNL":"Asia/Manila", "KWE":"Asia/Shanghai", "TAO":"Asia/Shanghai", "SUB":"Asia/Jakarta", "MAD":"Europe/Madrid", "HYD":"Asia/Kolkata", "FRA":"Europe/Berlin", "SFO":"America/Los_Angeles", "XMN":"Asia/Shanghai", "DXB":"Asia/Dubai", "KUL":"Asia/Kuala_Lumpur", "WUH":"Asia/Shanghai", "URC":"Asia/Shanghai", "YVR":"America/Vancouver", "EWR":"America/New_York", "DME":"Europe/Moscow", "TSN":"Asia/Shanghai", "HAK":"Asia/Shanghai", "MCO":"America/New_York", "CCU":"Asia/Kolkata", "BKK":"Asia/Bangkok", "HRB":"Asia/Shanghai", "MAA":"Asia/Kolkata", "CJU":"Asia/Seoul", "SAW":"Europe/Istanbul", "ICN":"Asia/Seoul", "UPG":"Asia/Makassar", "SGN":"Asia/Ho_Chi_Minh", "PHL":"America/New_York", "JNB":"Africa/Johannesburg", "FUK":"Asia/Tokyo", "BOS":"America/New_York", "CPH":"Europe/Copenhagen", "BWI":"America/New_York", "JFK":"America/New_York", "SHE":"Asia/Shanghai", "DLC":"Asia/Shanghai", "TNA":"Asia/Shanghai", "VIE":"Europe/Vienna", "GRU":"America/Sao_Paulo", "OSL":"Europe/Oslo", "ITM":"Asia/Tokyo", "CTS":"Asia/Tokyo", "YYC":"America/Edmonton", "MIA":"America/New_York", "SYX":"Asia/Shanghai", "DUB":"Europe/Dublin", "HNL":"Pacific/Honolulu", "LED":"Europe/Moscow", "BOG":"America/Bogota", "HET":"Asia/Shanghai", "VKO":"Europe/Moscow", "GMP":"Asia/Seoul", "DOH":"Asia/Qatar", "IAD":"America/New_York", "FLL":"America/New_York", "BNA":"America/Chicago", "YUL":"America/Toronto", "NNG":"Asia/Shanghai", "LHW":"Asia/Shanghai"
}

// not an exhaustive list of all cities understood by Intl.DateTimeFormat,
// but simply an inverted dictionary of the cities listed in overrides
var citynames = Object.entries(overrides).reduce((ret, [k, v]) => 
  {
    if (v) {
      ret[v.replace(/^.*\//, '')
         .replace(/_/g, '')
         .toUpperCase()] = v;
    }
    return ret; 
  }, {});

// in: string
// out: canonical city name, or original argument
function resolveZone(z) {
  return overrides[z.toUpperCase()] || 
    citynames[z.toUpperCase().replace(/[^A-Z]/g, '')] || 
    z;
}


var hourMoji = ["🕛","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚"];
var halfHourMoji = ["🕧","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦","🕧"];
var colors = [

]

exports.index = functions.https.onRequest((req, res) => {
  var path = req.params[0];


  var error;
  var zones = path.split(/[,.]/);
  console.log(path,zones)
  if (zones.length > 1) {
    try {
      var timeString = decodeURIComponent(zones.shift());
      // Handle difference in params[0] on local vs server (firebase) looking at leading slash
      var timeRE = /\/?(?<label>[^\/]+\/)?(?<h1>\d+):?(?<m1>\d\d)?(?<p1>[aph])?m?-?(?<h2>\d+)?:?(?<m2>\d\d)?(?<p2>[aph])?m?/
      var match = timeString.match(timeRE);
      var groups = match.groups;
      console.log("timeString: ",timeString, "match: ", match)

      var label = groups.label
      if (label) label = label.replace(/_/g," ").slice(0, -1)
      var start = dayjs().hour(groups.h1).minute(groups.m1 || 0)
      if (groups.p1 == "p" && start.hour() < 12) start = start.add(12, 'hour')

      var end = undefined;       //TODO: Fix the code to assume an end time
      if (groups.h2) {
        end = dayjs().hour(groups.h2).minute(groups.m2 || 0)
        if (groups.p2 == "p" && end.hour() < 12) end = end.add(12, 'hour')
      }

      var zone1 = resolveZone(zones[0]);

      start = start.tz(zone1,true);
      end = end ? end.tz(zone1,true) : undefined;

      console.log("Times", start, end)

      var zoneHTML = []
      var zoneStrings = []
      zones.forEach(zone => {
        var tzName = resolveZone(zone);
        if (zone.length) {
          var zoneStart = start.tz(tzName)
          var extraDay = start.day() < zoneStart.day()
          var startString = zoneStart.format("h:mm a").replace(" pm", "ᴘᴍ").replace(" am", "ᴀᴍ").replace(":00","")

          var endString = "";
          if (end) {
            var zoneEnd = end.tz(tzName)
            endString = zoneEnd.format("h:mm a").replace(" pm", "ᴘᴍ").replace(" am", "ᴀᴍ").replace(":00","")
          }

          var emoji = hourMoji[zoneStart.hour() % 12];
          var niceZoneName = zone.split("/").pop().replace(/_/g," ").toUpperCase()
          var description = `${startString}${endString ? "‑" + endString : ""} ${niceZoneName} ${extraDay ? " +1":""}`
          zoneStrings.push(description);

          var night = (zoneStart.hour() > 14 || zoneStart.hour() <= 6) ? "night" : ""
          zoneHTML.push(`
          <div class="zone ${night} g${zoneStart.hour()}">
            <div class="emoji">${emoji}</div>
            <div class="timezone">${niceZoneName}</div>
            <div class="time">${startString}${extraDay ? "&#8314;&#185;":""}${endString ? "<br>&#x25BD;<br>" : ""}${endString}</div>
          </div>`);
          //zoneInfos.push({e: emoji, t:tz, z: zone, d: description);
          }
        }
      )
      if (label) zoneStrings.push(label)

      var debugInfo = `
      ${zone1}
      ${start}
      ${start.format("h:mm a Z")}
      `
      var description = zoneStrings.join("  •  ");

      res.status(200).send(`<!doctype html>
        <!--${debugInfo}-->
        <head>
          <link rel="stylesheet" type="text/css" href="/index.css">
          <title>${description}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
          <meta property="og:title" content="${description}">
          <meta property="og:description" content="${label ||"timezone.fyi"}">
          <meta property="og:type" content="website">
        </head>
        <body style="font-family:sans-serif">

        <!--<div class="content">
        <div class="clock"></div>-->
        <div id="header">${label || ""}</div>
        <div id="zones">${zoneHTML.join("")}</div>



        </body>
      </html>`);
      return;
    } catch (e) {
      error = e;
    }
  }

  res.status(200).send(`<!doctype html>
    <head>
      <link rel="stylesheet" type="text/css" href="/index.css">
      <title>timezone.fyi</title>
    </head>
    <body style="font-family:sans-serif">
    <div class="content">
    <div class="clock"></div>
    <h1>timezone.fyi</h1>
    This site lets you quickly share a time across multiple time zones.
    <p>Simply type a url with the following structure:
    <br><b><a href="/10:30am,pst,est">http://timezone.fyi/10:30am,pst,est</a></b>
    <p>The first listed time zone will be treated as the primary. <a href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones">List of time zone names</a>

    <br>When you send these via Slack, SMS, and other modern chat clients,
    <br>they'll expand to show times in every listed zone.
    <div class="error">${error ? error.message : ""}</div>
    </div>
    </body>
    </html>`);

});
