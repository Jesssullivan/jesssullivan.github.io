<script lang="ts">
	import { BlobPhysics } from './BlobPhysics.js';
	import type { ConvexBlob } from './types.js';

	interface Props {
		blobs: ConvexBlob[];
	}

	let { blobs }: Props = $props();

	const blobPhysics = new BlobPhysics(false);
</script>

<svg
	width="100%"
	height="100%"
	viewBox="-33 -33 133 133"
	preserveAspectRatio="xMidYMid slice"
	class="w-full h-full"
	aria-hidden="true"
>
	<defs>
		<filter id="featherEdges" x="-200%" y="-200%" width="500%" height="500%">
			<feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur1" />
			<feGaussianBlur in="blur1" stdDeviation="2.0" result="blur2" />
			<feGaussianBlur in="blur2" stdDeviation="1.0" result="finalFeather" />
			<feComposite in="SourceGraphic" in2="finalFeather" operator="over" />
		</filter>

		<filter id="vibrancyBoost" x="-150%" y="-150%" width="400%" height="400%">
			<feColorMatrix
				mode="matrix"
				values="1.3 0 0 0 0  0 1.25 0 0 0  0 0 1.4 0 0  0 0 0 1.1 0"
			/>
			<feGaussianBlur stdDeviation="1.8" result="vibrantBlur" />
			<feComposite in="SourceGraphic" in2="vibrantBlur" operator="screen" />
		</filter>

		<filter id="backgroundGlow" x="-300%" y="-300%" width="700%" height="700%">
			<feGaussianBlur in="SourceGraphic" stdDeviation="8.0" result="ultraBlur" />
			<feColorMatrix
				in="ultraBlur"
				mode="matrix"
				values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2.5 0"
			/>
		</filter>

		<filter id="gentleBlur" x="-150%" y="-150%" width="400%" height="400%">
			<feGaussianBlur in="SourceGraphic" stdDeviation="2.0" />
		</filter>

		{#each blobs as blob (blob.gradientId)}
			<radialGradient id="{blob.gradientId}Core" cx="50%" cy="50%" r="30%">
				<stop offset="0%" stop-color={blob.color} stop-opacity={blob.intensity * 1.2} />
				<stop offset="40%" stop-color={blob.color} stop-opacity={blob.intensity * 0.9} />
				<stop offset="70%" stop-color={blob.color} stop-opacity={blob.intensity * 0.6} />
				<stop offset="100%" stop-color={blob.color} stop-opacity="0" />
			</radialGradient>

			<radialGradient id="{blob.gradientId}Mid" cx="50%" cy="50%" r="60%">
				<stop offset="0%" stop-color={blob.color} stop-opacity={blob.intensity * 0.8} />
				<stop offset="50%" stop-color={blob.color} stop-opacity={blob.intensity * 0.4} />
				<stop offset="100%" stop-color={blob.color} stop-opacity="0" />
			</radialGradient>

			<radialGradient id="{blob.gradientId}Outer" cx="50%" cy="50%" r="90%">
				<stop offset="0%" stop-color={blob.color} stop-opacity={blob.intensity * 0.5} />
				<stop offset="50%" stop-color={blob.color} stop-opacity={blob.intensity * 0.2} />
				<stop offset="100%" stop-color={blob.color} stop-opacity="0" />
			</radialGradient>

			<radialGradient id="{blob.gradientId}Atmosphere" cx="50%" cy="50%" r="400%">
				<stop offset="0%" stop-color={blob.color} stop-opacity={blob.intensity * 0.12} />
				<stop offset="50%" stop-color={blob.color} stop-opacity={blob.intensity * 0.06} />
				<stop offset="100%" stop-color="transparent" />
			</radialGradient>
		{/each}
	</defs>

	<!-- Background atmospheric layer -->
	<g filter="url(#backgroundGlow)">
		{#each blobs as blob (blob.gradientId)}
			<circle cx={blob.currentX} cy={blob.currentY} r={blob.size * 6.0} fill="url(#{blob.gradientId}Atmosphere)" opacity="0.6" />
		{/each}
	</g>

	<!-- Outer feathered layer -->
	<g filter="url(#vibrancyBoost)">
		{#each blobs as blob (blob.gradientId)}
			<circle cx={blob.currentX} cy={blob.currentY} r={blob.size * 2.2} fill="url(#{blob.gradientId}Outer)" opacity="0.75" />
		{/each}
	</g>

	<!-- Mid feathered layer -->
	<g filter="url(#gentleBlur)" style:mix-blend-mode="multiply">
		{#each blobs as blob (blob.gradientId)}
			<circle cx={blob.currentX} cy={blob.currentY} r={blob.size * 1.6} fill="url(#{blob.gradientId}Mid)" opacity="0.85" />
		{/each}
	</g>

	<!-- Core layer -->
	<g filter="url(#featherEdges)" style:mix-blend-mode="multiply">
		{#each blobs as blob (blob.gradientId)}
			<circle cx={blob.currentX} cy={blob.currentY} r={blob.size * 1.1} fill="url(#{blob.gradientId}Core)" opacity="0.9" />
		{/each}
	</g>

	<!-- Organic shape overlay -->
	<g filter="url(#vibrancyBoost)" style:mix-blend-mode="overlay" opacity="0.4">
		{#each blobs as blob (blob.gradientId)}
			<path
				d={blobPhysics.generateSmoothBlobPath(blob)}
				fill="url(#{blob.gradientId}Core)"
				opacity="0.6"
				transform="scale(0.8 0.8)"
				transform-origin="{blob.currentX} {blob.currentY}"
			/>
		{/each}
	</g>
</svg>
