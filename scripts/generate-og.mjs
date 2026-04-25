// Generate `public/og-default.jpg` (1200x630) for Open Graph / Twitter cards.
//
// Crops/centers `public/cafe-review-logo.png` onto a brand-coloured 1200x630
// background. The logo has lots of empty space around the edges, so we trim
// transparent pixels first and then fit the result into a target box.
//
// Run as `node scripts/generate-og.mjs` (wired into `prebuild` in package.json).

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

const SRC = resolve(repoRoot, 'public/cafe-review-logo.png');
const OUT = resolve(repoRoot, 'public/og-default.jpg');

const WIDTH = 1200;
const HEIGHT = 630;
// Brand background — matches `theme-color` in BaseHead.astro.
const BG = { r: 255, g: 107, b: 53, alpha: 1 };
// Pad around the logo as a fraction of the canvas.
const PAD_X = 80;
const PAD_Y = 80;

async function main() {
	if (!existsSync(SRC)) {
		console.warn(`[generate-og] Source logo missing at ${SRC}; skipping.`);
		return;
	}

	// Trim surrounding transparency so the logo fills more of the canvas.
	const trimmed = await sharp(SRC).trim().toBuffer();

	const innerWidth = WIDTH - PAD_X * 2;
	const innerHeight = HEIGHT - PAD_Y * 2;

	const logo = await sharp(trimmed)
		.resize({
			width: innerWidth,
			height: innerHeight,
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.toBuffer();

	await sharp({
		create: {
			width: WIDTH,
			height: HEIGHT,
			channels: 4,
			background: BG,
		},
	})
		.composite([{ input: logo, gravity: 'center' }])
		.jpeg({ quality: 88, mozjpeg: true })
		.toFile(OUT);

	console.log(`[generate-og] Wrote ${OUT}`);
}

main().catch((err) => {
	console.error('[generate-og] Failed:', err);
	process.exit(1);
});
