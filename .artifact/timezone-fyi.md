---
title: Timezone.fyi
date: 2020-11
category: product
tags:
  - web
  - time
url: https://timezone.fyi
links:
  source: https://github.com/arfct/timezone.fyi
media:
  - src: zones.png
    caption: A shared time, laid out in three cities
    alt: A page titled team sync with three columns, New York 10AM, London 3PM and Tokyo 12AM with a next-day marker, each with a clock face on its own gradient
  - src: airports.png
    caption: Four airport codes, each column colored for its hour
    alt: Four vertical columns, each with a clock face, labelled SFO 9AM on pale green, LHR 5PM on pink, DEL 10:30PM on navy and SYD 4AM with a next-day marker on deep blue
  - src: home.png
    caption: The landing page, which lists the URL format
    alt: A plain white page titled timezone.fyi listing the URL structure and the zone formats it accepts
unconfirmed:
  - date
---

timezone.fyi shows one time of day in several time zones from the URL alone. The address timezone.fyi/10am,NYC,LON,TOK shows that hour in each listed zone, on a page that can be pasted into a thread. It accepts time zone abbreviations, city aliases, IANA names, GMT offsets and airport codes, and it can return an .ics file so the time can be added to a calendar.

A serverless function parses the path. There is no app and no account.

JavaScript on Netlify Functions. 2020.
