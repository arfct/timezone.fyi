const functions = require('firebase-functions');
const moment = require('moment-timezone');
const dayjs = require('dayjs')
var utc = require('dayjs/plugin/utc') // dependent on utc plugin
var timezone = require('dayjs/plugin/timezone')
var customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

var overrides = {
  gmt: 0,
  edt: "America/New_York",
  est: "America/New_York",
  cdt: "America/Chicago",
  cst: "America/Chicago",
  mdt: "America/Denver",
  mst: "America/Denver",
  pdt: "America/Los_Angeles",
  pst: "America/Los_Angeles",
  lon: "Europe/London",
  nyc: "America/New_York",
  bos: "America/New_York",
  cam: "America/New_York",
  sf: "America/Los_Angeles",
  sea: "America/Los_Angeles",
  mtv: "America/Los_Angeles",
  mpo: "America/Los_Angeles",
  tok: "Asia/Tokyo"
}

var hourMoji = ["🕛","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚"];
var halfHourMoji = ["🕧","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦","🕧"];


exports.index = functions.https.onRequest((req, res) => {
  var path = req.params[0];
  path = path.substring(1);

  var error;
  var zones = path.split(/[_,]/);
  if (zones.length > 1) {
    try {
      var timeString = decodeURIComponent(zones.shift());
      var timeRE = /(?<h1>\d+)?:?(?<m1>\d\d)?(?<p1>[aph])?m?-?(?<h2>\d+)?:?(?<m2>\d\d)?(?<p2>[aph])?m?/
      var match = timeString.match(timeRE);
      var groups = match.groups;

      var start = dayjs().hour(groups.h1).minute(groups.m1 || 0)
      if (groups.p1 == "p") start = start.add(12, 'hour')
      console.log(groups, start)

      var end = undefined;
      if (groups.h2) {
        end = start
        end.hour(groups.h2)
        end.minute(groups.m2 || 0)
        if (groups.p2 == "p") end.add(12, 'hour')
      }


      var zone1 = zones[0];
      zone1 = overrides[zone1.toLowerCase()] || zone1;

      start = start.tz(zone1,true);
      end = end ? end.tz(zone1,true) : undefined;
      console.log("start", start)
      console.log("end  ", end)

      
      //console.log("Converting from:", zone1)
      var day = start;
      //day = day.subtract(2, 'hours'); // ugh shoot me

      day 
      var zoneHTML = []
      var zoneStrings = [];
      zones.forEach(zone => {
        var realzone = overrides[zone.toLowerCase()] || zone;
        //console.log("Converting to:", realzone)
        if (zone.length) {
          var tz = day.tz(realzone);
          var emoji = hourMoji[tz.hour() % 12];
          var start = tz.format("h:mm a").replace(" pm", "ᴘᴍ").replace(" am", "ᴀᴍ")}
          var description = `${emoji} ${start} ${zone.toUpperCase()}`
          zoneStrings.push(description);
          var night = (tz.hour() > 18 || tz.hour <= 6) ? "night" : ""
          zoneHTML.push(`
          <div class="zone ${night}">
            <div class="emoji">${emoji}</div>
            <div class="time">${start}</div>
            <div class="zone">${zone.toUpperCase()}</div>
          </div>`);
          //zoneInfos.push({e: emoji, t:tz, z: zone, d: description);
        }
      )

      var debugInfo = `
      ${zone1}
      ${day}
      ${day.format("h:mm a Z")}
      `
      var description = zoneStrings.join("   ");

      res.status(200).send(`<!doctype html>
        <!--${debugInfo}-->
        <head>
          <link rel="stylesheet" type="text/css" href="/index.css">
          <title>${description}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
          <meta property="og:title" content="${description}">
          <meta property="og:description" content="timezone.fyi">
          <meta property="og:type" content="website"> 
        </head>
        <body style="font-family:sans-serif">
        
        <div class="content">

        <div class="clock"></div>
        <h1><a href="/">timezone.fyi</a></h1>
        The following times are equivalent:
        <h2>${zoneHTML.join("")}</h2>


        </div>
          
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
