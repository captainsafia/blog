/*
 * The site accent color is picked "at random" every day, but deterministically:
 * the current date (UTC) is hashed into a seed that drives a small PRNG, which
 * picks the accent hue. Everyone sees the same color on a given day, and the
 * color changes when the date rolls over.
 */

// FNV-1a hash of a string, as an unsigned 32-bit integer.
export function hashDateKey(key: string): number {
	let h = 2166136261;
	for (let i = 0; i < key.length; i++) {
		h ^= key.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

// Mulberry32: tiny seeded PRNG, good enough for picking a color.
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hslToHex(h: number, s: number, l: number): string {
	const sat = s / 100;
	const lum = l / 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = sat * Math.min(lum, 1 - lum);
	const f = (n: number) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const to255 = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
	return `#${to255(f(0))}${to255(f(8))}${to255(f(4))}`;
}

export interface AccentColor {
	accent: string;
	accentDark: string;
	accentTint: string;
	accentTintBorder: string;
}

// Saturation and lightness are fixed so links stay readable on the light
// background; only the hue varies from day to day.
export function getAccentColor(date: Date = new Date()): AccentColor {
	const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
	const hue = Math.floor(mulberry32(hashDateKey(key))() * 360);
	return {
		accent: hslToHex(hue, 45, 40),
		accentDark: hslToHex(hue, 45, 30),
		// Pale washes of the same hue for code blocks and table headers, so
		// tinted backgrounds follow the accent instead of staying one color.
		accentTint: hslToHex(hue, 35, 94),
		accentTintBorder: hslToHex(hue, 30, 88),
	};
}
