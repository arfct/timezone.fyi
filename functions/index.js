import { getZoneInfo } from "./common.js";

export default async (req, context) => {
  let url = new URL(req.url);
  var path = url.pathname.replace("/.netlify/functions/index", "");

  console.log("path", path);

  var error;
  var zoneHTML = [];
  var zoneStrings = [];

  var info = getZoneInfo(path);

  if (info && !info.error) {
    info.zones.forEach((z) => {
      zoneStrings.push(z.description);
      zoneHTML.push(`
      <div class="zone ${z.night} g${z.zoneStart.hour()}">
        <div class="emoji">${z.emoji}</div>
        <div class="timezone">
          <div class="nicezone">${z.niceZoneName}</div>
          <div class="actualzone">${z.zoneStart.zone().name()}</div>
        </div>
        <div class="time">${z.startString}${z.extraDay ? "⁺¹" : ""}${
        z.endString ? `<div class="dash">–</div>` : ""
      }${z.endString}</div>
        
      </div>`);
    });

    if (info.label) zoneStrings.push(info.label);

    let dtstart = `DTSTART;TZID=${info.start.zone().name()}:${info.start.format(
      "yyyyMMddThhmmss"
    )}`;
    console.log({ dtstart });
    let duration = "PT" + (info.duration || 30) + "M";
    var description = zoneStrings.join("  •  ");

    let defaultName = "timezone.fyi event";
    var vcalendar = encodeURIComponent(
      `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//hacksw/handcal//NONSGML v1.0//EN
BEGIN:VEVENT
SUMMARY:${info.label || defaultName}
LOCATION:${url.toString()}
DESCRIPTION:${description}
${dtstart}
DURATION:${duration}
END:VEVENT
END:VCALENDAR`
    );
    return new Response(
      `<!doctype html>
      <!--${JSON.stringify(info)}-->
      <head>
        <link rel="stylesheet" type="text/css" href="/index.css">
        <title>${info.label || description}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
        <meta property="og:title" content="${description}">
        <meta property="og:description" content="${
          info.label || "timezone.fyi"
        }">
        ${
          info.zones
            ? `<meta property="og:image" content="https://timezone.fyi/og.jpg?path=${req.path}">`
            : ""
        }
        <meta property="og:type" content="website">
      </head>
      <body class="${info.label ? "labelled" : ""}">
      <a id="download" download="${info.label || defaultName}.ics" title="${
        info.label || description
      }" href="data:text/calendar;charset=utf8,${vcalendar}" target="_blank" rel="noopener noreferrer"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 25 25"><mask id="a" width="25" height="25" x="0" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path d="M.352.121h24v24h-24z"/></mask><g mask="url(#a)"><path d="M17.352 22.12v-3h-3v-2h3v-3h2v3h3v2h-3v3h-2Zm-12-2c-.55 0-1.021-.195-1.413-.586a1.928 1.928 0 0 1-.587-1.413v-12c0-.55.196-1.021.587-1.412a1.927 1.927 0 0 1 1.413-.588h1v-2h2v2h6v-2h2v2h1c.55 0 1.02.196 1.413.588.391.39.587.862.587 1.412v6.1a6.733 6.733 0 0 0-2 0v-2.1h-12v8h7c0 .333.025.666.075 1 .05.333.142.666.275 1h-7.35Zm0-12h12v-2h-12v2Z"/></g></svg></a>
      <div id="header"><span>${info.label || ""}</span></div>
      <div id="zones">${zoneHTML.join("")}</div>
      </body>
    </html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  }
  return new Response(
    `<!doctype html>
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
    </html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
};

// export const config = {
//   path: "/tz/*",
// };
