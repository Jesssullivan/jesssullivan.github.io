import { describe, expect, it } from 'vitest';
import { EXCERPT_MAX, SHORT_EXCERPT, excerptOf, isCutFromBody, plainText, proseOf, saysNothingNew, sentencesOf } from './excerpt';

const of = (description: string, body = '', title = 'A title') => excerptOf({ title, description, body });
/** A summary the old export cut from the top of the post by count, with its three dots. */
const cut = (body: string) => `${plainText(body.replace(/\n+/g, ' ')).slice(0, 155)}...`;

describe('a summary she wrote', () => {
	it('stands as she wrote it when it is short', () => {
		expect(of('Photo gallery from warbler field research in New Hampshire.')).toBe('Photo gallery from warbler field research in New Hampshire.');
		// It need not end with a mark. It is hers.
		expect(of('Field notes and a few photographs from the bog')).toBe('Field notes and a few photographs from the bog');
	});

	it('is cut at a sentence end when it is long, never inside a sentence', () => {
		const first = 'A complete reference for resetting the lock from Linux.';
		const second = `Recovering the maintenance protocol, ${'the per-session state, '.repeat(12)}and the key.`;
		expect(of(`${first}  ${second}`)).toBe(first);
		const two = 'Every device on the tailnet was tagged. The gateway does not know tagged devices.';
		expect(of(`${two} A third sentence that makes the whole too long to keep, ${'because it goes on and on, '.repeat(7)}as some do.`)).toBe(two);
		expect(two.length).toBeLessThanOrEqual(EXCERPT_MAX);
	});

	it('does not end a sentence at an initial or a short form', () => {
		const text = 'Fieldwork in Canaan, NH with Dr. Leonard Reitsma at Plymouth State University.';
		expect(sentencesOf(text)).toEqual([text]);
		expect(sentencesOf('Check out my new Jess S. photography site! It is up.')).toEqual(['Check out my new Jess S. photography site!', 'It is up.']);
		expect(sentencesOf('Two visits, 2.19.17 - 2.20.17, to the sit spot. Cold.')).toEqual(['Two visits, 2.19.17 - 2.20.17, to the sit spot.', 'Cold.']);
	});

	it('treats a row of dots as her pause, and a row that opens the next words as a start', () => {
		expect(sentencesOf('If you happened to be working with.... KML data, read on. Good.')).toEqual(['If you happened to be working with.... KML data, read on.', 'Good.']);
		expect(sentencesOf('Playing with Sonar --> morning metal ....Frankly the whole suite is better.')).toEqual(['Playing with Sonar --> morning metal', '....Frankly the whole suite is better.']);
	});
});

describe('a summary the export cut by count', () => {
	it('is known by standing at the top of the post, letter for letter', () => {
		const body = '[_get this script here on github_](https://example.org/x)\n\nThe Ebird dataset is awesome. While directly handling data as a massive delimited file is cumbersome at best, the api is fine and it works well for this.';
		expect(isCutFromBody(cut(body), body)).toBe(true);
		expect(isCutFromBody('A walkthrough for converting bird observation points to CSV.', body)).toBe(false);
		expect(isCutFromBody('Bash &amp; friends are great: a shell is baked into every computer...', 'Bash & friends are great: a shell is baked into every computer and more follows here.')).toBe(true);
	});

	it('gives way to her first sentences of prose, read from the post', () => {
		const body = '[_get this script here on github_](https://example.org/x)\n\nThe Ebird dataset is awesome. While directly handling data as a massive delimited file is cumbersome at best, the api is fine and it works well for this.';
		expect(of(cut(body), body)).toBe('The Ebird dataset is awesome. While directly handling data as a massive delimited file is cumbersome at best, the api is fine and it works well for this.');
	});

	it('passes over a heading, a list, a table, code, a picture, a frame and a link that stands alone', () => {
		const body = ['# A heading.', '  * A list item that ends.', '| a | b |\n|---|---|\n| c | d |', '```sh\necho "Not prose."\n```', '![A picture.](/images/posts/x.jpg)', '<iframe src="https://example.org"></iframe>', '[A link alone.](https://example.org)', '    indented code.', 'Her first real sentence. And a second one.'].join('\n\n');
		expect(proseOf(body).map((paragraph) => paragraph.text)).toEqual(['Her first real sentence. And a second one.']);
		expect(of(cut(body), body)).toBe('Her first real sentence. And a second one.');
	});

	it('strips the marks left at the start, and the markup', () => {
		expect(of('', '…Despite being a **chilly** & wintery March up [here](https://example.org) in the mountains, there is no shortage of birds!')).toBe('Despite being a chilly & wintery March up here in the mountains, there is no shortage of birds!');
		expect(of('', '?:Organization for Flask + React using the niftyBlueprints library.')).toBe('Organization for Flask + React using the niftyBlueprints library.');
		expect(plainText('a `code` word, snake_case_name, \\_kept\\_ and &amp; &#8217;')).toBe('a code word, snake_case_name, _kept_ and & ’');
	});

	it('drops a sentence that only points at a link that is gone, and the clause that does before a colon', () => {
		const body = 'Edit 07/26/2020: Check out the expanded notes page here! I need to run these products on my laptop.';
		expect(of(cut(body), body)).toBe('I need to run these products on my laptop.');
		expect(of('', 'Check out this project here: Tetrahedron is a mutual aid group that goes on.')).toBe('Tetrahedron is a mutual aid group that goes on.');
		// "Here" at the head of a sentence is hers.
		expect(of('', 'Here we have an interesting chord progression idea.')).toBe('Here we have an interesting chord progression idea.');
	});

	it('never shows a line that is cut off, holds an address or is the trace of a player', () => {
		expect(of('', 'Add a button for the car- wiring reference: http://example.org/a.pdf\n\nBig shiny button in the car!')).toBe('Big shiny button in the car!');
		expect(of('', '🎵: Jess S. · Evening Metal 9.14.20')).toBe('');
		expect(of('', 'Guitar Practice:')).toBe('');
		expect(of('', 'See a need, fill a need! | An exciting new venture! | Chemicals and experiments oh my!')).toBe('');
		expect(of('', 'REPO_PATH="./" OVMF_DIR="."')).toBe('');
	});

	it('keeps only sentences that stand next to each other in her text', () => {
		const body = 'One whole sentence here stands. A second one follows it.\n\n## A heading between\n\nA third one after the heading.';
		expect(of('', body)).toBe('One whole sentence here stands. A second one follows it.');
		const joined = 'One whole sentence here stands.\n\nA second paragraph follows it.';
		expect(of('', joined)).toBe('One whole sentence here stands. A second paragraph follows it.');
	});

	it('does not show the words of someone else, a quotation that runs on, or a note the export wrote', () => {
		const body = '_"by Christopher - Thursday, 5:38 PM_\n\n_Bomber day in the woods. We saw a frog."_\n\n...This is a brilliant depiction. Best of luck rearing the kiddos.';
		expect(of('', body)).toBe('This is a brilliant depiction. Best of luck rearing the kiddos.');
		expect(of('', '"First, we build the reactor. Then we wait. Soon it glows." So said the plan. I made the tools myself in the dorm.')).toBe('So said the plan. I made the tools myself in the dorm.');
		expect(of('', '*This image has been lost to time. The original was hosted on WordPress.*\n\nWith the app now working, the repo is live. Check it out!***This space once held an image. The WordPress CDN has since gone quiet.***')).toBe('With the app now working, the repo is live. Check it out!');
	});

	it('keeps her sentence set in italics, and passes over a label set in italics', () => {
		expect(of('', '_A spur-of-the moment turkey thermometer with dubious accuracy._\n\nUses an equation to estimate the temperature.')).toBe('A spur-of-the moment turkey thermometer with dubious accuracy. Uses an equation to estimate the temperature.');
		expect(of('', '_In other tangents..._\n\nThe enclosure is moving into its new home.')).toBe('The enclosure is moving into its new home.');
		expect(of('', "_Jess's Monday:_\n\nThe enclosure is moving into its new home.")).toBe('The enclosure is moving into its new home.');
	});

	it('takes off the title where the export set it again above the text', () => {
		expect(of('', 'Solar upgrades! Incredibly, the hut had another solar panel just laying around.', 'Solar upgrades!')).toBe('Incredibly, the hut had another solar panel just laying around.');
	});
});

describe('an excerpt that says nothing', () => {
	it('is absent when it tells a reader of the title nothing more', () => {
		expect(saysNothingNew('Click here for the PDF: Generate convex hull polygons and centroids from KML', 'How To Generate convex hull polygons and centroids from KML')).toBe(true);
		expect(of('Click here for the PDF: Generate convex hull polygons and centroids from KML', '', 'How To Generate convex hull polygons and centroids from KML')).toBe('');
		expect(saysNothingNew('Photo gallery of warblers in the hand during bird banding research.', 'Gallery of "Warblers in the Hand"')).toBe(false);
	});

	it('is absent when no whole sentence is found', () => {
		expect(of('', '')).toBe('');
		expect(of('', '## Afternoon scribbles & prints:\n\n  * Nezuko as a coaster\n  * Big hooks for warm winter coats')).toBe('');
	});

	it('is always her words in her order: a run of the text, never a new sentence', () => {
		const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
		const body = '…Notes ….Even more demos @ the site — — —\n\nI wrote this lil application while riding on a bus- find the repository [here](https://example.org) at jess/Report. 😸 It reads reports.';
		const excerpt = of(cut(body), body);
		expect(excerpt).not.toBe('');
		expect(letters(body.replace(/\(https[^)]*\)/g, ''))).toContain(letters(excerpt));
	});
});

describe('the short excerpt of a post that is words alone', () => {
	const post = (description: string) => ({ title: 'A title', description, body: '' });

	it('is the same run of her sentences, ended sooner, at a sentence end', () => {
		const one = 'Every device on the tailnet was tagged.';
		const two = 'The gateway does not know tagged devices.';
		const three = 'I was locked out of my own gateway, and a throwaway program in Go got me back in before lunch.';
		expect(excerptOf(post(`${one} ${two} ${three}`))).toBe(`${one} ${two} ${three}`);
		expect(excerptOf(post(`${one} ${two} ${three}`), SHORT_EXCERPT)).toBe(`${one} ${two}`);
		expect(`${one} ${two}`.length).toBeLessThanOrEqual(SHORT_EXCERPT.max);
	});

	it('lets one first sentence run a little longer, and is absent beyond that', () => {
		const fits = `A first sentence of a hundred and sixty letters or so, ${'which goes on, '.repeat(6)}and then it stops.`;
		expect(fits.length).toBeGreaterThan(SHORT_EXCERPT.max);
		expect(fits.length).toBeLessThanOrEqual(SHORT_EXCERPT.longest);
		expect(excerptOf(post(`${fits} And more.`), SHORT_EXCERPT)).toBe(fits);
		const over = `A first sentence that is far too long, ${'which goes on and on, '.repeat(8)}and then it stops.`;
		expect(over.length).toBeGreaterThan(SHORT_EXCERPT.longest);
		expect(excerptOf(post(`${over} And more.`), SHORT_EXCERPT)).toBe('');
		// The longer excerpt still keeps it.
		expect(excerptOf(post(`${over} And more.`))).toBe(over);
	});
});
