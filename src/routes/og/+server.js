import sharp from "sharp";

import { getZoneInfo, colors } from "$lib/timezones.js";

const generateLinearGradient = (gradientId, stops) => {
  const backgroundStops = stops
  .map((color, index) => {
    const offset = (index / (stops.length - 1) * 100);
    return `<stop offset="${offset}%" style="stop-color:${color}"/>`;
  })
  .join('');
  return `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">${backgroundStops}</linearGradient>`;
}

const generateZoneRect = (zone, x, y, width, height, gradientId) => {
  const fontSizeZone = width / 10;
  const fontSizeTime = width / 5;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const textColor = zone.night ? "white" : "black";

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#${gradientId})" />
  <text 
    x="${centerX}" 
    y="${centerY}" 
    opacity="0.5"
    font-family="sans-serif" 
    font-size="${fontSizeZone}pt" 
    text-anchor="middle" 
    fill="${textColor}"
    dominant-baseline="middle"
    filter="drop-shadow(5px 5px 10px rgba(0,0,0,0.1))"
  >
   ${zone.niceZoneName}
  </text>
  <text 
    x="${centerX}" 
    y="${centerY + fontSizeTime}" 
    fill="${textColor}"
    opacity="0.8"
    font-family="sans-serif" 
    font-size="${fontSizeTime}pt" 
    text-anchor="middle" 
    dominant-baseline="middle"
    filter="drop-shadow(5px 5px 10px rgba(0,0,0,0.1))"
  >
   ${zone.startString}
  </text>
  `
}

const generateSvg = (width, height, zones) => {
  const gradients = zones.map((z, i) => {
    if (!z.zoneStart) {
      return '';
    }
    const start = colors[z.zoneStart.hour * 2];
    const end = colors[z.zoneStart.hour * 2 + 1];
    const gradient = generateLinearGradient(`gradient${i}`, [start, end]);
    return gradient;
  }).join('');

  const zoneBlocks = zones.map((z, i) => {
    const zoneWidth = width / zones.length;
    const x = zoneWidth * i;
    const rect = generateZoneRect(z, x, 0, zoneWidth, height, `gradient${i}`);
    return rect;
  }).join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
      ${gradients}
      </defs>
      ${zoneBlocks}
    </svg>`

    return svg;
}

export const GET = async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return new Response("Missing path", { status: 400 });
  }
  const info = getZoneInfo(path);
  const width = 1200
  const height = 630
  const svg = generateSvg(width, height, info.zones);
  const buffer = await sharp(Buffer.from(svg))
  .jpeg()
  .toBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=60, s-maxage=31536000",
    },
  });
}