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
    caption: A labelled time in three cities, with Tokyo marked as the next day
    alt: A page titled team sync with three columns, New York 10AM, London 3PM and Tokyo 12AM with a next-day marker, each with a clock face on its own gradient
  - src: airports.png
    caption: Four airport codes, each column colored for its local hour
    alt: Four vertical columns, each with a clock face, labelled SFO 9AM on pale green, LHR 5PM on pink, DEL 10:30PM on navy and SYD 4AM with a next-day marker on deep blue
  - src: home.png
    caption: The landing page, which explains the URL format
    alt: A plain white page titled timezone.fyi listing the URL structure and the zone formats it accepts
unconfirmed:
  - date
---

timezone.fyi shows one time of day in several time zones, and reads both from its URL. The address timezone.fyi/10am,NYC,LON,TOK returns a page with a column for each zone, holding a clock face, the zone's code and the local time. Each column is colored for its local hour, and a time that falls on another day carries a +1 or −1 marker. The time can be a range such as 10am-2pm, or `now` for a clock that updates every minute, and a label can precede it.

Zones can be written as abbreviations, city aliases, IANA names, GMT offsets or airport codes. The airport table has about 9,800 entries. A link pasted into a chat gets a preview image of the times, and the button at the top right of the page downloads an .ics file for a calendar.

A Netlify function parses the path and renders the page. The site moved from Firebase to Netlify in October 2024.

JavaScript, Netlify Functions. 2020.
