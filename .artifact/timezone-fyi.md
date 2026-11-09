---
title: Timezone.fyi
date: 2020-11
category: product
tags:
  - web
url: https://timezone.fyi
links:
  source: https://github.com/arfct/timezone.fyi
media:
  - src: zones.png
    caption: A shared time, laid out in three cities
    alt: A page titled team sync with three columns, New York 10AM, London 3PM and Tokyo 12AM with a next-day marker, each with a clock face on its own gradient
  - src: airports.png
    caption: Four airport codes, each column dressed for its hour
    alt: Four vertical columns, each with a clock face, labelled SFO 9AM on pale green, LHR 5PM on pink, DEL 10:30PM on navy and SYD 4AM with a next-day marker on deep blue
  - src: home.png
    caption: The landing page, explaining its own URL format
    alt: A plain white page titled timezone.fyi listing the URL structure and the zone formats it accepts
unconfirmed:
  - date
---

"What time is it there when it's 3pm here" is arithmetic nobody should do twice. timezone.fyi does it once and hands you a link. The URL is the interface: timezone.fyi/10am,NYC,LON,TOK renders that hour in every listed zone, ready to paste into a thread. It accepts abbreviations, city aliases, IANA names, GMT offsets, and airport codes—and will hand back an .ics file so the time survives contact with a calendar.

A serverless function parses the path; no app, no account.

JavaScript on Netlify Functions. 2020.
