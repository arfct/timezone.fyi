const functions = require('firebase-functions');
var tc = require("timezonecomplete");
const { Canvas } = require('canvas');

var overrides = {
  ACDT: 10.5, ACST: 9.5, ACT: 8, ADT: -3, AEDT: 11, AEST: 10, AFT: 4.5, AKDT: -8, AKST: -9, AMST: 5, AMT: 4, ART: -3, AST: -4, AWDT: 9, AWST: 8, AZOST: -1, AZT: 4, BDT: 8, BIOT: 6, BIT: -12, BOT: -4, BRT: -3, BST: 1, BTT: 6, CAT: 2, CCT: 6.5, CDT: -5, CEDT: 2, CEST: 2, CET: 1, CHADT: 13.75, CHAST: 12.75, CHOT: -8, CHST: 10, CHUT: 10, CIST: -8, CIT: 8, CKT: -10, CLST: -3, CLT: -4, COST: -4, COT: -5, CST: -6, CT: 8, CVT: -1, CWST: 8.75, CXT: 7, DAVT: 7, DDUT: 7, DFT: 1, EASST: -5, EAST: -6, EAT: 3, ECT: -5, EDT: -4, EEDT: 3, EEST: 3, EET: 2, EGST: 0, EGT: -1, EIT: 9, EST: -5, FET: 3, FJT: 12, FKST: -3, FKT: -4, FNT: -2, GALT: -6, GAMT: -9, GET: 4, GFT: -3, GILT: 12, GIT: -9, GMT: 0, GST: 4, GYT: -4, HADT: -9, HAEC: 2, HAST: -10, HKT: 8, HMT: 5, HOVT: 7, HST: -10, ICT: 7, IDT: 3, IOT: 3, IRDT: 8, IRKT: 8, IRST: 3.5, JST: 9, KGT: 7, KOST: 11, KRAT: 7, KST: 9, LHST: 11, LINT: 14, MAGT: 12, MART: -9.5, MAWT: 5, MDT: -6, MEST: 2, MET: 1, MHT: 12, MIST: 11, MIT: -9.5, MMT: 6.5, MSK: 4, MST: -7, MUT: 4, MVT: 5, MYT: 8, NCT: 11, NDT: -2.5, NFT: 11.5, NPT: 5.75, NST: -3.5, NT: -3.5, NUT: -11.5, NZDT: 13, NZST: 12, OMST: 6, ORAT: -5, PDT: -7, PET: -5, PETT: 12, PGT: 10, PHOT: 13, PHT: 8, PKT: 5, PMDT: 8, PMST: 8, PONT: 11, PST: 8, RET: 4, ROTT: -3, SAKT: 11, SAMT: 4, SAST: 2, SBT: 11, SCT: 4, SGT: 8, SLT: 5.5, SRT: -3, SST: -11, SYOT: 3, TAHT: -10, TFT: 5, THA: 7, TJT: 5, TKT: 14, TLT: 9, TMT: 5, TOT: 13, TVT: 12, UCT: 0, ULAT: 8, UYST: -2, UYT: -3, UZT: 5, VET: -4.5, VLAT: 10, VOLT: 4, VOST: 6, VUT: 11, WAKT: 12, WAST: 2, WAT: 1, WEDT: 1, WEST: 1, WET: 0, WST: 8, YAKT: 9, YEKT: 5, 
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
  IST: "Asia/Kolkata",
  BOM: "Asia/Kolkata",
  "CGK":"Asia/Jakarta", "DFW":"America/Chicago", "ATL":"America/New_York", "DEN":"America/Denver", "DEL":"Asia/Kolkata", "ORD":"America/Chicago", "CAN":"Asia/Shanghai", "CLT":"America/New_York", "HND":"Asia/Tokyo", "KMG":"Asia/Shanghai", "CKG":"Asia/Shanghai", "PEK":"Asia/Shanghai", "XIY":"Asia/Shanghai", "SZX":"Asia/Shanghai", "CTU":"Asia/Shanghai", "PVG":"Asia/Shanghai", "SEA":"America/Los_Angeles", "MEX":"America/Mexico_City", "SHA":"Asia/Shanghai", "YYZ":"America/Toronto", "BOM":"Asia/Kolkata", "HGH":"Asia/Shanghai", "LAX":"America/Los_Angeles", "LHR":"Europe/London", "AMS":"Europe/Amsterdam", "PHX":"America/Phoenix", "BLR":"Asia/Kolkata", "NKG":"Asia/Shanghai", "PKX":"Asia/Shanghai", "IAH":"America/Chicago", "LAS":"America/Los_Angeles", "MSP":"America/Chicago", "SVO":"Europe/Moscow", "CGO":"Asia/Shanghai", "CSX":"Asia/Shanghai", "DTW":"America/Detroit", "DMK":"Asia/Bangkok", "CDG":"Europe/Paris", "SLC":"America/Denver", "MNL":"Asia/Manila", "KWE":"Asia/Shanghai", "TAO":"Asia/Shanghai", "SUB":"Asia/Jakarta", "MAD":"Europe/Madrid", "HYD":"Asia/Kolkata", "FRA":"Europe/Berlin", "SFO":"America/Los_Angeles", "XMN":"Asia/Shanghai", "DXB":"Asia/Dubai", "KUL":"Asia/Kuala_Lumpur", "WUH":"Asia/Shanghai", "URC":"Asia/Shanghai", "YVR":"America/Vancouver", "EWR":"America/New_York", "DME":"Europe/Moscow", "TSN":"Asia/Shanghai", "HAK":"Asia/Shanghai", "MCO":"America/New_York", "CCU":"Asia/Kolkata", "BKK":"Asia/Bangkok", "HRB":"Asia/Shanghai", "MAA":"Asia/Kolkata", "CJU":"Asia/Seoul", "SAW":"Europe/Istanbul", "ICN":"Asia/Seoul", "UPG":"Asia/Makassar", "SGN":"Asia/Ho_Chi_Minh", "PHL":"America/New_York", "JNB":"Africa/Johannesburg", "FUK":"Asia/Tokyo", "BOS":"America/New_York", "CPH":"Europe/Copenhagen", "BWI":"America/New_York", "JFK":"America/New_York", "SHE":"Asia/Shanghai", "DLC":"Asia/Shanghai", "TNA":"Asia/Shanghai", "VIE":"Europe/Vienna", "GRU":"America/Sao_Paulo", "OSL":"Europe/Oslo", "ITM":"Asia/Tokyo", "CTS":"Asia/Tokyo", "YYC":"America/Edmonton", "MIA":"America/New_York", "SYX":"Asia/Shanghai", "DUB":"Europe/Dublin", "HNL":"Pacific/Honolulu", "LED":"Europe/Moscow", "BOG":"America/Bogota", "HET":"Asia/Shanghai", "VKO":"Europe/Moscow", "GMP":"Asia/Seoul", "DOH":"Asia/Qatar", "IAD":"America/New_York", "FLL":"America/New_York", "BNA":"America/Chicago", "YUL":"America/Toronto", "NNG":"Asia/Shanghai", "LHW":"Asia/Shanghai", "CMN":"Africa/Casablanca"
}

// not an exhaustive list of all cities understood by Intl.DateTimeFormat,
// but simply an inverted dictionary of the cities listed in overrides
// var citynames = Object.entries(overrides).reduce((ret, [k, v]) => 
//   {
//     console.log("v", v);
//     if (v) {
//       ret[v.replace(/^.*\//, '')
//          .replace(/_/g, '')
//          .toUpperCase()] = v;
//     }
//     return ret; 
//   }, {});

// in: string
// out: canonical city name, or original argument
function resolveZone(z) {
  z = overrides[z.toUpperCase()] ?? z;

  console.log("Z", z)
  let tzd = tc.TzDatabase.instance()

  if (isNaN(z)) {
    if (!tzd.exists(z)) { // Uppercase for country names
      z = z[0].toUpperCase() + z.substring(1)
    }
  } else {
    z *= 60;
  }

  return z;
}



var hourMoji = ["🕛","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚"];
var halfHourMoji = ["🕧","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦","🕧"];
var colors = []

function getZoneInfo(path) {
  var error;
  var info = undefined;
  var zones = path.split(/[,.]/);

  if (zones.length > 1) {
    try {
      var timeString = decodeURIComponent(zones.shift());
      // Handle difference in params[0] on local vs server (firebase) looking at leading slash
      var timeRE = /\/?(?<label>[^\/]+\/)?(?<h1>\d?\d):?(?<m1>\d\d)?(?<p1>[aph])?m?-?(?<h2>\d?\d)?:?(?<m2>\d\d)?(?<p2>[aph])?m?/
      var match = timeString.match(timeRE);
      var groups = match.groups;

      var label = groups.label
      if (label) label = label.replace(/_/g," ").slice(0, -1)

      var firstZone = resolveZone(zones[0]);

      var start = new tc.now(tc.zone(firstZone)).startOfDay()
        .add(tc.hours(parseInt(groups.h1)))
        .add(tc.minutes(parseInt(groups.m1) || 0))

      if (groups.p1 == "p" && start.hour() < 12) start = start.add(tc.hours(12))
      var end = undefined;
      if (groups.h2) {
        end = new tc.now(tc.zone(firstZone)).startOfDay()
          .add(tc.hours(parseInt(groups.h2)))
          .add(tc.minutes(parseInt(groups.m2) || 0))
        if (groups.p1 == "p" && end.hour() < 12) end = end.add(tc.hours(12))
      }

      info = {zones: [], label}
      zones.forEach(zone => {

        var tzName = resolveZone(zone);
        if (zone.length) {
          var z = zoneInfo = {};
          var tcz = tc.zone(tzName);

          var zoneStart = start.toZone(tcz);
          var extraDay = start.day() < zoneStart.day()
          var startString = zoneStart.format("h:mm a").replace(" pm", "ᴘᴍ").replace(" am", "ᴀᴍ").replace(":00","")

          var endString = "";
          if (end) {
            var zoneEnd = end.toZone(tcz);
            endString = zoneEnd.format("h:mm a").replace(" pm", "ᴘᴍ").replace(" am", "ᴀᴍ").replace(":00","")
          }

          var emoji = hourMoji[zoneStart.hour() % 12];
          var niceZoneName = tcz.name().split("/").pop().replace(/_/g," ").toUpperCase()

          var description = `${startString}${endString ? "‑" + endString : ""} ${niceZoneName} ${extraDay ? " +1":""}`
          var night = (zoneStart.hour() > 14 || zoneStart.hour() <= 6) ? "night" : ""
          var zoneInfo = {description, night, zoneStart, zoneEnd, emoji, niceZoneName, startString, endString, extraDay};
          info.zones.push(zoneInfo)

          }
        }
      )
    } catch (e) {
      return {error: e.message}
    }

    return info; 
  }
  return undefined;
}

exports.index = functions.https.onRequest((req, res) => {
  var path = req.params[0];

  var error;
  var zoneHTML = []
  var zoneStrings = []

  var info = getZoneInfo(path);

  if (info && !info.error) {
    info.zones.forEach((z) => {
      zoneStrings.push(z.description);
      zoneHTML.push(`
      <div class="zone ${z.night} g${z.zoneStart.hour()}">
        <div class="emoji">${z.emoji}</div>
        <div class="timezone">${z.niceZoneName}</div>
        <div class="time">${z.startString}${z.extraDay ? "&#8314;&#185;":""}${z.endString ? "<br>&#x25BD;<br>" : ""}${z.endString}</div>
      </div>`);
    });
  
    if (info.label) zoneStrings.push(info.label)

    var description = zoneStrings.join("  •  ");

    res.status(200).send(`<!doctype html>
      <!--${JSON.stringify(info)}-->
      <head>
        <link rel="stylesheet" type="text/css" href="/index.css">
        <title>${description}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
        <meta property="og:title" content="${description}">
        <meta property="og:description" content="${info.label ||"timezone.fyi"}">
        ${ info.zones ? `<meta property="og:image" content="https://timezone.fyi/og.jpg?path=${req.path}">` : ""}
        <meta property="og:type" content="website">
      </head>
      <body style="font-family:sans-serif">
      <div id="header">${info.label || ""}</div>
      <div id="zones">${zoneHTML.join("")}</div>
      </body>
    </html>`);
    return;
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
    <div class="error">${info && info.error ? info.error : ""}</div>
    </div>
    </body>
    </html>`);

});

var colors = ["#012459", "#001322", "#003972", "#001322", "#003972", "#001322", "#004372", "#00182b", "#004372", "#011d34", "#016792", "#00182b", "#07729f", "#042c47", "#12a1c0", "#07506e", "#74d4cc", "#1386a6", "#efeebc", "#61d0cf", "#fee154", "#a3dec6", "#fdc352", "#e8ed92", "#ffac6f", "#ffe467", "#fda65a", "#ffe467", "#fd9e58", "#ffe467", "#f18448", "#ffd364", "#f06b7e", "#f9a856", "#ca5a92", "#f4896b", "#5b2c83", "#d1628b", "#371a79", "#713684", "#28166b", "#45217c", "#192861", "#372074", "#040b3c", "#233072", "#040b3c", "#012459" ];

exports.og = functions.https.onRequest((req, res) => {
  console.log("PATH", req.query.path)
    const info = getZoneInfo(req.query.path);
    const canvas = new Canvas(1200, 630);
    const ctx = canvas.getContext('2d');

    if (info) {
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,1.0)";
      ctx.fill();

      var count = info.zones.length;
      var width = canvas.width / count;
      var height = canvas.height;
      var size = width / 5;
      ctx.textAlign = "center";
      info.zones.forEach( (z, i) => {
        ctx.beginPath();
        ctx.rect(width * i, 0, width, canvas.height);
        var hour = z.zoneStart.hour();
        var grd = ctx.createLinearGradient(0, 0, 0, height);
        grd.addColorStop(0, colors[hour * 2]);
        grd.addColorStop(1, colors[hour * 2 + 1]);
        ctx.fillStyle = grd
        console.log(colors[hour * 2], colors[hour * 1 + 1]);
        ctx.fill();
      })

      info.zones.forEach( (z, i) => {
        ctx.fillStyle = z.night ? "white" : "black";
        ctx.globalCompositeOperation = "hard-light"
        
        ctx.font = `${size/1.5}px Arial`;
        ctx.globalAlpha = 0.5;
        ctx.fillText(z.niceZoneName, width * (0.5 + i), height/2 - size/2);

        ctx.font = `${size}px Arial`;
        ctx.globalAlpha = 0.8;
        ctx.fillText(z.startString, width * (0.5 + i), height/2 + size/2);


      })



    } else {
    }

    res.set('Cache-Control', 'public, max-age=60, s-maxage=31536000');
    res.writeHead(200, {'Content-Type': 'image/jpeg', 'Content-Disposition': 'attachment; filename="ogimage.jpg"'});
    canvas.createJPEGStream().pipe(res);

});
