import sharp from "sharp";
import process from "process";
import { json } from "@sveltejs/kit";

// Forces the use of the fonts in the lambda layer.
process.env.FONTCONFIG_PATH='/var/task/fonts'

const fontFamily = 'Roboto'


export const GET = async (req) => {
  console.log(process.env)

  return json({env: process.env});

}