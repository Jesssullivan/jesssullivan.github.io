/**
 * The page script of a note body. The hub renders a clip and a video by
 * reference as plain HTML that works with no script: a clip stands still on
 * its poster, and a video is a link to the player. This script adds the rest
 * in the browser, as the hub's own pages do.
 *
 * A clip is a short silent video. It starts muted, looping and inline unless
 * the reader asked for reduced motion, and its button is shown with words
 * that follow the video: Pause the clip while it plays, Play the clip while
 * it stands. A reader who asks for reduced motion sees the poster and the
 * button, and nothing moves until she presses it. A clip that plays stops
 * when she switches reduced motion on.
 *
 * A video by reference shows its poster. A press on it loads the player from
 * youtube-nocookie.com in place. Until then the page asks YouTube for
 * nothing.
 */

export const PLAY_WORDS = 'Play the clip';
export const PAUSE_WORDS = 'Pause the clip';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYER_BASE = 'https://www.youtube-nocookie.com/embed/';

/** Starts and wires every clip inside a note body. The returned function undoes it. */
function wireClips(root: HTMLElement): () => void {
	const pairs = [...root.querySelectorAll('figure.embed-clip')].flatMap((figure) => {
		const video = figure.querySelector('video[data-clip]');
		const button = figure.querySelector('button[data-clip-toggle]');
		return video instanceof HTMLVideoElement && button instanceof HTMLButtonElement ? [{ video, button }] : [];
	});
	if (pairs.length === 0) return () => {};
	const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const undo: (() => void)[] = [];
	for (const { video, button } of pairs) {
		const show = () => {
			button.textContent = video.paused ? PLAY_WORDS : PAUSE_WORDS;
		};
		// A browser may refuse to play, for one to save data. A file it cannot
		// read sends an error to the source element and leaves play waiting. In
		// both cases the video is put back to rest, so the button says Play and
		// never Pause over a picture that stands still.
		const rest = () => {
			video.pause();
			show();
		};
		const start = () => void video.play().catch(rest);
		const toggle = () => {
			if (!video.paused) return video.pause();
			// After a failed read the browser waits for a new source. A fresh load lets a press try again.
			if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) video.load();
			start();
		};
		// The attributes are in the HTML. The properties are set too, since a
		// video placed by script does not always take muted from its attribute,
		// and a phone plays a clip inline and unasked only when it is muted.
		video.muted = true;
		video.loop = true;
		video.playsInline = true;
		video.addEventListener('play', show);
		video.addEventListener('pause', show);
		// The error of a source element does not bubble, so it is caught on its way down.
		video.addEventListener('error', rest, true);
		button.addEventListener('click', toggle);
		button.hidden = false;
		show();
		if (!motion.matches) start();
		undo.push(() => {
			video.removeEventListener('play', show);
			video.removeEventListener('pause', show);
			video.removeEventListener('error', rest, true);
			button.removeEventListener('click', toggle);
			video.pause();
		});
	}
	const onChange = (event: MediaQueryListEvent) => {
		if (event.matches) for (const { video } of pairs) video.pause();
	};
	motion.addEventListener('change', onChange);
	undo.push(() => motion.removeEventListener('change', onChange));
	return () => {
		for (const step of undo) step();
	};
}

/**
 * Loads a video by reference in place when the reader presses its poster.
 * One listener on the body serves every poster in it. A press with a
 * modifier key, or on a link that is not the hub's player link for the id
 * the figure carries, is left to the browser.
 */
function wireYoutube(root: HTMLElement): () => void {
	const onClick = (event: MouseEvent) => {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = event.target instanceof Element ? event.target.closest('a.embed-play') : null;
		const figure = link?.closest('figure.embed-youtube');
		if (!(link instanceof HTMLAnchorElement) || !figure || !root.contains(figure)) return;
		const id = figure.getAttribute('data-youtube-id') ?? '';
		if (!YOUTUBE_ID.test(id) || link.href !== `${PLAYER_BASE}${id}`) return;
		event.preventDefault();
		const frame = document.createElement('iframe');
		const title = figure.querySelector('figcaption')?.firstChild?.textContent?.trim();
		frame.className = 'embed-player';
		frame.title = title || 'Video on YouTube';
		frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
		frame.allowFullscreen = true;
		frame.referrerPolicy = 'strict-origin-when-cross-origin';
		frame.src = `${PLAYER_BASE}${id}?autoplay=1`;
		link.replaceWith(frame);
		frame.focus();
	};
	root.addEventListener('click', onClick);
	return () => root.removeEventListener('click', onClick);
}

/** Wires the clips and the video posters of one note body. The returned function undoes it. */
export function wireNoteMedia(root: HTMLElement): () => void {
	const undo = [wireClips(root), wireYoutube(root)];
	return () => {
		for (const step of undo) step();
	};
}
