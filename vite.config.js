import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy'

const staticCopyConfig = {
	targets: [
		{
			src: 'static/fonts/fonts.conf',
			dest: 'fonts/'
		},
		{
			src: 'static/fonts/Roboto-Regular-webfont.woff',
			dest: 'fonts'
		}

	]
}

export default defineConfig({
	plugins: [sveltekit(), viteStaticCopy(staticCopyConfig)],
	server: {
		host: '0.0.0.0',
		port: 12345
	}

});
