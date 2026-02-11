<script lang="ts">
	let {
		url,
		title = 'Video player'
	}: {
		url: string;
		title?: string;
	} = $props();

	// Convert youtube.com/watch?v= and youtu.be/ to youtube-nocookie embed URL
	let embedUrl = $derived(() => {
		let videoId = '';
		try {
			const u = new URL(url);
			if (u.hostname.includes('youtube.com')) {
				videoId = u.searchParams.get('v') || '';
			} else if (u.hostname === 'youtu.be') {
				videoId = u.pathname.slice(1);
			}
		} catch {
			return url;
		}
		if (videoId) {
			return `https://www.youtube-nocookie.com/embed/${videoId}`;
		}
		// Playlist URL
		try {
			const u = new URL(url);
			const list = u.searchParams.get('list');
			if (list) {
				return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
			}
		} catch {
			// fall through
		}
		return url;
	});
</script>

<div class="video-embed my-6">
	<div class="relative w-full" style="padding-bottom: 56.25%;">
		<iframe
			src={embedUrl()}
			{title}
			class="absolute inset-0 w-full h-full rounded-lg"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
			loading="lazy"
		></iframe>
	</div>
</div>
