<script lang="ts">
	let {
		trackUrl,
		title = 'SoundCloud player',
		height = 166
	}: {
		trackUrl: string;
		title?: string;
		height?: number;
	} = $props();

	let embedUrl = $derived(
		`https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&color=%231abc9c&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`
	);
</script>

<div class="soundcloud-embed my-6">
	<iframe
		width="100%"
		height={height}
		scrolling="no"
		frameborder="0"
		allow="autoplay"
		loading="lazy"
		src={embedUrl}
		{title}
	></iframe>
</div>
