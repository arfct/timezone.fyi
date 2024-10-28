import type { Config, Context } from "@netlify/edge-functions";
import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";
import React from "https://esm.sh/react@18.2.0";
import {DateTime} from "https://esm.sh/luxon@2";

export const emptyZoneInfo = (): any=> {
  return  {
    description: '',
  night: false,
  zoneStart: DateTime.local(),
  zoneEnd: null,
  emoji: '',
  niceZoneName: 'SPC',
  startString: '00:01 PM',
  endString: '',
  extraDay: false,
};
}

const getZoneInfo = (path: string) : any => {
  let zones : any[] = [];
  zones.push(emptyZoneInfo());
  return {zones};
}


export default async (request: Request, context: Context) => {
  let url = new URL(request.url);
  let path = url.searchParams.get("path");

  const info = {}; //getZoneInfo(path);
  if (!info.zones) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 128,
          backgroundImage: "linear-gradient(#e66465, #9198e5)"
        }}
      >
        Hello!
      </div>
    );
  }

  const zones = info.zones;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 128,
          backgroundImage: "linear-gradient(#e66465, #9198e5)"
        }}
      >
        {zones.map((z, i) => (  
          <div key={i}
            style={{  
              backgroundImage: `linear-gradient(${colors[z.zoneStart.hour() * 2]}, ${colors[z.zoneStart.hour() * 2 + 1]})`,
            }}
          >
          
            <div>{z.niceZoneName}</div>
            <div>{z.startString}</div>
          </div>
        ))}
        Hello!
      </div>
    )
  );
}

export const config = {
  path: "/ogx",
  cache: "manual",
};


// //og.jpg?path=
// export default async (request, context) => {
//   let url = new URL(request.url);
//   let path = url.searchParams.get("path");
//   const info = getZoneInfo(path);

//   console.log("URL:", info);

//   // const canvas = new Canvas(1200, 630);
//   // const ctx = canvas.getContext("2d");

//   // if (info) {
//   //   ctx.beginPath();
//   //   ctx.rect(0, 0, canvas.width, canvas.height);
//   //   ctx.fillStyle = "rgba(255,255,255,1.0)";
//   //   ctx.fill();

//   //   var count = info.zones.length;
//   //   var width = canvas.width / count;
//   //   var height = canvas.height;
//   //   var size = width / 5;
//   //   ctx.textAlign = "center";
//   //   info.zones.forEach((z, i) => {
//   //     ctx.beginPath();
//   //     ctx.rect(width * i, 0, width, canvas.height);
//   //     var hour = z.zoneStart.hour();
//   //     var grd = ctx.createLinearGradient(0, 0, 0, height);
//   //     grd.addColorStop(0, colors[hour * 2]);
//   //     grd.addColorStop(1, colors[hour * 2 + 1]);
//   //     ctx.fillStyle = grd;
//   //     console.log(colors[hour * 2], colors[hour * 1 + 1]);
//   //     ctx.fill();
//   //   });

//   //   info.zones.forEach((z, i) => {
//   //     ctx.fillStyle = z.night ? "white" : "black";
//   //     ctx.globalCompositeOperation = "hard-light";

//   //     ctx.font = `${size / 1.5}px Arial`;
//   //     ctx.globalAlpha = 0.5;
//   //     ctx.fillText(z.niceZoneName, width * (0.5 + i), height / 2 - size / 2);

//   //     ctx.font = `${size}px Arial`;
//   //     ctx.globalAlpha = 0.8;
//   //     ctx.fillText(z.startString, width * (0.5 + i), height / 2 + size / 2);
//   //   });
//   // }

//   // const stream = canvas.createJPEGStream();
//   // const chunks = [];

//   // for await (let chunk of stream) {
//   //   chunks.push(chunk);
//   // }

//   // const buffer = Buffer.concat(chunks);

//   // return {
//   //   statusCode: 200,
//   //   headers: {
//   //     "Content-Type": "image/jpeg",
//   //     "Content-Disposition": 'attachment; filename="ogimage.jpg"',
//   //     "Cache-Control": "public, max-age=60, s-maxage=31536000",
//   //   },
//   //   body: buffer.toString("base64"),
//   //   isBase64Encoded: true,
//   // };
// };

// export const config = {
//   path: "/og.jpg*",
// };