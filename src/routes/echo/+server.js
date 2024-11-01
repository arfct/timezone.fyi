import sharp from 'sharp';
import process from 'process';
import fs from 'fs';
import { json } from '@sveltejs/kit';

// Forces the use of the fonts in the lambda layer.
process.env.FONTCONFIG_PATH = '/var/task/.netlify/server/fonts';

const fontFamily = 'Roboto';

export const GET = async ({ url }) => {
	let localPath = url.searchParams.path;
	if (!localPath) {
		localPath = '/var/task/.netlify/server';
	}
	console.log(process.env);
	let error = '';
	let dirfiles = [];
	try {
		dirfiles = fs.readdirSync(localPath);
	} catch (e) {
		error = e.toString();
	}

	return json({ env: process.env, dirfiles, error });
};
