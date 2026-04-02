import { DateTime } from "luxon";
import { decodeHTML } from "entities";
import { parse } from "node-html-parser";

/**
 * Build TOC from post HTML. Layout runs before IdAttributePlugin, so headings often
 * have no `id` yet — we assign the same slugs Eleventy will add (slugify + duplicates).
 *
 * @param {string} html
 * @param {(s: string) => string} slugifyFn Eleventy `slugify` filter
 * @returns {{ id: string, level: "h2"|"h3", text: string }[]}
 */
export function extractTocFromHtml(html, slugifyFn) {
	if (!html || typeof html !== "string") return [];
	const root = parse(html, { blockTextElements: { script: true, style: true, pre: true } });
	/** @type {{ id: string, level: "h2"|"h3", text: string }[]} */
	const out = [];
	/** @type {Record<string, number>} */
	const conflictCheck = {};

	for (const el of root.querySelectorAll("h2, h3")) {
		const tag = el.tagName.toLowerCase();
		if (tag !== "h2" && tag !== "h3") continue;

		const rawText = el.textContent.replace(/\s+/g, " ").trim();
		if (!rawText) continue;
		const text = decodeHTML(rawText);

		let id = el.getAttribute("id") || "";
		if (id) {
			if (conflictCheck[id]) {
				conflictCheck[id]++;
				id = `${id}-${conflictCheck[id]}`;
			} else {
				conflictCheck[id] = 1;
			}
		} else {
			const base = slugifyFn(text);
			if (conflictCheck[base]) {
				conflictCheck[base]++;
				id = `${base}-${conflictCheck[base]}`;
			} else {
				conflictCheck[base] = 1;
				id = base;
			}
		}

		out.push({ id, level: /** @type {"h2"|"h3"} */ (tag), text });
	}
	return out;
}

export default function(eleventyConfig) {
	eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
		// Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
		return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(format || "dd LLLL yyyy");
	});

	eleventyConfig.addFilter("htmlDateString", (dateObj) => {
		// dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
		return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat('yyyy-LL-dd');
	});

	// Get the first `n` elements of a collection.
	eleventyConfig.addFilter("head", (array, n) => {
		if(!Array.isArray(array) || array.length === 0) {
			return [];
		}
		if( n < 0 ) {
			return array.slice(n);
		}

		return array.slice(0, n);
	});

	// Return the smallest number argument
	eleventyConfig.addFilter("min", (...numbers) => {
		return Math.min.apply(null, numbers);
	});

	// Return the keys used in an object
	eleventyConfig.addFilter("getKeys", target => {
		return Object.keys(target);
	});

	eleventyConfig.addFilter("filterTagList", function filterTagList(tags) {
		return (tags || []).filter(tag => ["all", "posts"].indexOf(tag) === -1);
	});

	eleventyConfig.addFilter("sortAlphabetically", strings =>
		(strings || []).sort((b, a) => b.localeCompare(a))
	);

	eleventyConfig.addFilter("tocFromContent", (html) => {
		const slugify = eleventyConfig.getFilter("slugify");
		return extractTocFromHtml(html, slugify);
	});
};
