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
    caption: A labelled time in three cities, where midnight in Tokyo carries a +1 because it falls on the next day
    alt: A page titled team sync with three columns, New York 10AM, London 3PM and Tokyo 12AM with a next-day marker, each with a clock face on its own gradient
  - src: airports.png
    caption: Four airport codes, each on the gradient for its local hour, with Delhi's clock face at ten o'clock for 10:30
    alt: Four vertical columns, each with a clock face, labelled SFO 9AM on pale green, LHR 5PM on pink, DEL 10:30PM on navy and SYD 4AM with a next-day marker on deep blue
  - src: home.png
    caption: The landing page, which gives the URL format and the kinds of zone it accepts
    alt: A plain white page titled timezone.fyi listing the URL structure and the zone formats it accepts
unconfirmed:
  - date
---

IST is India Standard Time in the address timezone.fyi/10am,pst,ist and Istanbul's airport in timezone.fyi/10am,lhr,ist. The site reads a time and a list of zones from its own URL and returns a page with a column for each zone. Zones may be written as abbreviations, city aliases, IANA names, GMT offsets or any of about 9,800 airport and metro codes. Many abbreviations are also airport codes, and the few that are plausible either way are settled by the first code in the list that can be read only one way.

Each column holds a clock face set to the hour alone, the zone's code and the local time, on a gradient chosen for that hour from a set of 24. A time on a different day from the first zone's carries a superscript +1 or −1. The time can be a range such as 10am-2pm, or the word now for a page that redraws at the top of every minute, and a label placed before it becomes the page's heading.

A link sent through Slack or SMS expands to an image of the same colored columns, with each zone's code and time. The button at the top right adds the time to Google Calendar or downloads it as an .ics file. A Netlify function parses the path and renders the page; the site moved there from Firebase in October 2024.

JavaScript, Netlify Functions. 2020.
