import sharp from "sharp";
import process from "process";
import fs from "fs";
import { json } from "@sveltejs/kit";

// Forces the use of the fonts in the lambda layer.
process.env.FONTCONFIG_PATH='/var/task/.netlify/server/fonts'

const fontFamily = 'Roboto'


export const GET = async (req) => {
  console.log(process.env)
  let error = ''
  let dirfiles = []
  try {
    dirfiles = fs.readdirSync('/var/task/.netlify/server');
  } catch (e) {
    error = e.toString();
  } 

  return json({env: process.env, dirfiles, error});

}