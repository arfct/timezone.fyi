import { Canvas } from "canvas";
import { getZoneInfo } from "./common.js";

export default async (event, context) => {
  console.log("PATH", event.queryStringParameters.path);
  const info = getZoneInfo(event.queryStringParameters.path);
  const canvas = new Canvas(1200, 630);
  const ctx = canvas.getContext("2d");

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
    info.zones.forEach((z, i) => {
      ctx.beginPath();
      ctx.rect(width * i, 0, width, canvas.height);
      var hour = z.zoneStart.hour();
      var grd = ctx.createLinearGradient(0, 0, 0, height);
      grd.addColorStop(0, colors[hour * 2]);
      grd.addColorStop(1, colors[hour * 2 + 1]);
      ctx.fillStyle = grd;
      console.log(colors[hour * 2], colors[hour * 1 + 1]);
      ctx.fill();
    });

    info.zones.forEach((z, i) => {
      ctx.fillStyle = z.night ? "white" : "black";
      ctx.globalCompositeOperation = "hard-light";

      ctx.font = `${size / 1.5}px Arial`;
      ctx.globalAlpha = 0.5;
      ctx.fillText(z.niceZoneName, width * (0.5 + i), height / 2 - size / 2);

      ctx.font = `${size}px Arial`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(z.startString, width * (0.5 + i), height / 2 + size / 2);
    });
  }

  const stream = canvas.createJPEGStream();
  const chunks = [];

  for await (let chunk of stream) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": 'attachment; filename="ogimage.jpg"',
      "Cache-Control": "public, max-age=60, s-maxage=31536000",
    },
    body: buffer.toString("base64"),
    isBase64Encoded: true,
  };
};
