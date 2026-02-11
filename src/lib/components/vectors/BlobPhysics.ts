import type { ConvexBlob, ColorDefinition } from './types.js';

export class BlobPhysics {
	private blobs: ConvexBlob[] = [];
	private isDark: boolean;

	private readonly PHYSICS_MIN = -40;
	private readonly PHYSICS_MAX = 140;

	// Pine theme colors — subtle, earthy tones
	private lightColors: Record<string, ColorDefinition> = {
		pineGreen: { color: 'rgba(26, 188, 156, 0.35)', scrollAffinity: 0.4 },
		forestTeal: { color: 'rgba(22, 160, 133, 0.3)', scrollAffinity: 0.5 },
		mossGreen: { color: 'rgba(39, 174, 96, 0.25)', scrollAffinity: 0.3 },
		mistBlue: { color: 'rgba(52, 152, 219, 0.2)', scrollAffinity: 0.35 },
		cloudWhite: { color: 'rgba(236, 240, 241, 0.25)', scrollAffinity: 0.25 },
	};

	private darkColors: Record<string, ColorDefinition> = {
		pineGreen: { color: 'rgba(26, 188, 156, 0.25)', scrollAffinity: 0.4 },
		forestTeal: { color: 'rgba(22, 160, 133, 0.2)', scrollAffinity: 0.5 },
		deepEmerald: { color: 'rgba(0, 128, 96, 0.2)', scrollAffinity: 0.3 },
		nightBlue: { color: 'rgba(41, 128, 185, 0.15)', scrollAffinity: 0.35 },
		shadowGreen: { color: 'rgba(30, 80, 60, 0.2)', scrollAffinity: 0.25 },
	};

	constructor(isDark: boolean) {
		this.isDark = isDark;
	}

	public updateTheme(isDark: boolean): void {
		if (this.isDark === isDark) return;
		this.isDark = isDark;
		const colors = isDark ? this.darkColors : this.lightColors;
		const colorEntries = Object.values(colors);
		this.blobs.forEach((blob, i) => {
			blob.color = colorEntries[i % colorEntries.length].color;
		});
	}

	public initializeBlobs(): ConvexBlob[] {
		const colors = this.isDark ? this.darkColors : this.lightColors;
		const colorEntries = Object.entries(colors);

		this.blobs = colorEntries.map(([, colorData], i) => {
			const totalBlobs = colorEntries.length;
			const angle = (i / totalBlobs) * Math.PI * 2;
			const radius = 35 + Math.random() * 30;

			const baseX = 50 + Math.cos(angle) * radius + (Math.random() - 0.5) * 25;
			const baseY = 50 + Math.sin(angle) * radius + (Math.random() - 0.5) * 25;

			const clampedX = Math.max(this.PHYSICS_MIN + 25, Math.min(this.PHYSICS_MAX - 25, baseX));
			const clampedY = Math.max(this.PHYSICS_MIN + 25, Math.min(this.PHYSICS_MAX - 25, baseY));

			const baseSize = 28 + Math.random() * 18;

			const numControlPoints = 16;
			const controlPoints = [];
			const controlVelocities = [];

			for (let j = 0; j < numControlPoints; j++) {
				const pointAngle = (j / numControlPoints) * Math.PI * 2;
				const radiusVariation = 0.8 + Math.random() * 0.35;
				const pointRadius = baseSize * radiusVariation;

				controlPoints.push({
					radius: pointRadius,
					angle: pointAngle,
					targetRadius: pointRadius,
					baseRadius: pointRadius,
				});
				controlVelocities.push({
					radialVelocity: 0,
					angularVelocity: (Math.random() - 0.5) * 0.0004,
				});
			}

			return {
				baseX: clampedX,
				baseY: clampedY,
				currentX: clampedX,
				currentY: clampedY,
				velocityX: (Math.random() - 0.5) * 0.06,
				velocityY: (Math.random() - 0.5) * 0.06,
				size: baseSize,
				elasticity: 0.0008 + Math.random() * 0.0004,
				viscosity: 0.988 + Math.random() * 0.008,
				phase: Math.random() * Math.PI * 2,
				speed: 0.006 + Math.random() * 0.003,
				color: colorData.color,
				gradientId: `blob${i}`,
				intensity: 0.65 + Math.random() * 0.2,
				scrollAffinity: colorData.scrollAffinity,
				fluidMass: 0.5 + Math.random() * 0.25,
				controlPoints,
				controlVelocities,
				chaosLevel: 0,
				driftAngle: Math.random() * Math.PI * 2,
				driftSpeed: 0.03 + Math.random() * 0.04,
				territoryRadius: 70 + Math.random() * 50,
				territoryX: clampedX,
				territoryY: clampedY,
				personalSpace: 50 + Math.random() * 30,
				repulsionStrength: 0.018 + Math.random() * 0.01,
				lastRepulsionTime: 0,
				wallBounceCount: 0,
				lastBounceTime: 0,
			};
		});

		return this.blobs;
	}

	public update(
		deltaTime: number,
		time: number,
		scrollStickiness: number,
		pullForces?: Array<{ strength: number; time: number; randomness: number; explosive: boolean }>
	): void {
		this.applyAntiClustering();
		this.blobs.forEach((blob) => this.updateBlobPhysics(blob, time, scrollStickiness, pullForces || []));
	}

	private applyAntiClustering(): void {
		for (let i = 0; i < this.blobs.length; i++) {
			const blob1 = this.blobs[i];
			for (let j = i + 1; j < this.blobs.length; j++) {
				const blob2 = this.blobs[j];
				const dx = blob2.currentX - blob1.currentX;
				const dy = blob2.currentY - blob1.currentY;
				const distance = Math.sqrt(dx * dx + dy * dy);
				const requiredDistance = Math.max(blob1.personalSpace, blob2.personalSpace);

				if (distance < requiredDistance && distance > 0) {
					const overlap = requiredDistance - distance;
					const repulsionForce = (overlap / requiredDistance) * 0.055;
					const normalizedDx = dx / distance;
					const normalizedDy = dy / distance;
					const proximityMultiplier = distance < requiredDistance * 0.7 ? 3.5 : 1.0;

					blob1.velocityX -= normalizedDx * repulsionForce * blob1.repulsionStrength * proximityMultiplier;
					blob1.velocityY -= normalizedDy * repulsionForce * blob1.repulsionStrength * proximityMultiplier;
					blob2.velocityX += normalizedDx * repulsionForce * blob2.repulsionStrength * proximityMultiplier;
					blob2.velocityY += normalizedDy * repulsionForce * blob2.repulsionStrength * proximityMultiplier;

					blob1.lastRepulsionTime = Date.now();
					blob2.lastRepulsionTime = Date.now();
				}
			}
		}
	}

	private updateBlobPhysics(
		blob: ConvexBlob,
		time: number,
		scrollStickiness: number,
		pullForces: Array<{ strength: number; time: number; randomness: number; explosive: boolean }>
	): void {
		this.updateTerritorialMovement(blob, time);
		this.updateMovement(blob, time);
		this.addEscapeVelocity(blob);
		this.updateOrganicDeformation(blob, time);

		if (scrollStickiness > 0.01) {
			blob.chaosLevel = Math.min(blob.chaosLevel + scrollStickiness * 0.02, 0.15);
		}

		pullForces.forEach((force) => {
			if (blob.scrollAffinity > 0.1) {
				const mildForce = force.strength * 0.15;
				const randomAngle = Math.random() * Math.PI * 2;
				blob.velocityX += Math.cos(randomAngle) * mildForce * 0.01;
				blob.velocityY += Math.sin(randomAngle) * mildForce * 0.01;
			}
		});

		blob.currentX += blob.velocityX;
		blob.currentY += blob.velocityY;

		this.handleWallBouncing(blob);

		blob.velocityX *= 0.992;
		blob.velocityY *= 0.992;
	}

	private updateMovement(blob: ConvexBlob, time: number): void {
		blob.velocityX += (Math.random() - 0.5) * 0.001;
		blob.velocityY += (Math.random() - 0.5) * 0.001;

		const brownianTime = time * 0.1 + blob.phase;
		blob.velocityX += Math.sin(brownianTime + blob.driftAngle) * 0.0005;
		blob.velocityY += Math.cos(brownianTime * 1.3 + blob.driftAngle) * 0.0005;

		if (Math.random() < 0.002) blob.driftAngle = Math.random() * Math.PI * 2;
	}

	private updateTerritorialMovement(blob: ConvexBlob, time: number): void {
		const distanceFromTerritory = Math.sqrt(
			Math.pow(blob.currentX - blob.territoryX, 2) + Math.pow(blob.currentY - blob.territoryY, 2)
		);

		if (distanceFromTerritory > blob.territoryRadius) {
			const pullStrength = ((distanceFromTerritory - blob.territoryRadius) / blob.territoryRadius) * 0.0002;
			const angleToTerritory = Math.atan2(blob.territoryY - blob.currentY, blob.territoryX - blob.currentX);
			blob.velocityX += Math.cos(angleToTerritory) * pullStrength;
			blob.velocityY += Math.sin(angleToTerritory) * pullStrength;
		}

		blob.velocityX += (Math.random() - 0.5) * 0.003;
		blob.velocityY += (Math.random() - 0.5) * 0.003;

		if (time % 45 < 0.1) {
			blob.territoryX = Math.max(
				this.PHYSICS_MIN + 35,
				Math.min(this.PHYSICS_MAX - 35, blob.territoryX + (Math.random() - 0.5) * 35)
			);
			blob.territoryY = Math.max(
				this.PHYSICS_MIN + 35,
				Math.min(this.PHYSICS_MAX - 35, blob.territoryY + (Math.random() - 0.5) * 35)
			);
		}
	}

	private addEscapeVelocity(blob: ConvexBlob): void {
		if (blob.lastRepulsionTime && Date.now() - blob.lastRepulsionTime < 3000) {
			const escapeAngle = Math.random() * Math.PI * 2;
			blob.velocityX += Math.cos(escapeAngle) * 0.01;
			blob.velocityY += Math.sin(escapeAngle) * 0.01;
		}
	}

	private updateOrganicDeformation(blob: ConvexBlob, time: number): void {
		blob.controlPoints.forEach((point, i) => {
			const pulseTime = time * 0.15 + i * 0.4 + blob.phase;
			const pulseAmount = Math.sin(pulseTime) * 0.02;

			const minRadius = point.baseRadius * 0.85;
			const maxRadius = point.baseRadius * 1.15;
			point.targetRadius = Math.max(minRadius, Math.min(maxRadius, point.baseRadius * (1 + pulseAmount)));

			const radiusDiff = point.targetRadius - point.radius;
			point.radius += radiusDiff * 0.008;

			blob.controlVelocities[i].angularVelocity += (Math.random() - 0.5) * 0.00003;
			blob.controlVelocities[i].angularVelocity *= 0.999;
			blob.controlVelocities[i].angularVelocity = Math.max(
				-0.0008,
				Math.min(0.0008, blob.controlVelocities[i].angularVelocity)
			);
			point.angle += blob.controlVelocities[i].angularVelocity;
		});

		this.smoothControlPoints(blob);
	}

	private smoothControlPoints(blob: ConvexBlob): void {
		if (blob.controlPoints.length < 3) return;

		for (let i = 0; i < blob.controlPoints.length; i++) {
			const current = blob.controlPoints[i];
			const prev = blob.controlPoints[(i - 1 + blob.controlPoints.length) % blob.controlPoints.length];
			const next = blob.controlPoints[(i + 1) % blob.controlPoints.length];

			const avgRadius = (prev.radius + current.radius + next.radius) / 3;
			current.radius = current.radius * 0.95 + avgRadius * 0.05;
		}
	}

	private handleWallBouncing(blob: ConvexBlob): void {
		const margin = blob.size * 0.8;
		const damping = 0.65;

		if (blob.currentX < this.PHYSICS_MIN + margin) {
			blob.currentX = this.PHYSICS_MIN + margin;
			blob.velocityX = Math.abs(blob.velocityX) * damping;
			this.recordBounce(blob);
		}
		if (blob.currentX > this.PHYSICS_MAX - margin) {
			blob.currentX = this.PHYSICS_MAX - margin;
			blob.velocityX = -Math.abs(blob.velocityX) * damping;
			this.recordBounce(blob);
		}
		if (blob.currentY < this.PHYSICS_MIN + margin * 1.5) {
			blob.currentY = this.PHYSICS_MIN + margin * 1.5;
			blob.velocityY = Math.abs(blob.velocityY) * damping;
			this.recordBounce(blob);
		}
		if (blob.currentY > this.PHYSICS_MAX - margin * 1.5) {
			blob.currentY = this.PHYSICS_MAX - margin * 1.5;
			blob.velocityY = -Math.abs(blob.velocityY) * damping;
			this.recordBounce(blob);
		}
	}

	private recordBounce(blob: ConvexBlob): void {
		blob.wallBounceCount++;
		blob.lastBounceTime = Date.now();
		blob.velocityX += (Math.random() - 0.5) * 0.05;
		blob.velocityY += (Math.random() - 0.5) * 0.05;
		blob.driftAngle = Math.random() * Math.PI * 2;
		blob.chaosLevel = Math.min(blob.chaosLevel + 0.04, 0.15);
	}

	public generateSmoothBlobPath(blob: ConvexBlob): string {
		if (blob.controlPoints.length < 3) {
			return `M ${blob.currentX - blob.size},${blob.currentY}
				A ${blob.size},${blob.size} 0 1,1 ${blob.currentX + blob.size},${blob.currentY}
				A ${blob.size},${blob.size} 0 1,1 ${blob.currentX - blob.size},${blob.currentY}`;
		}

		const points = blob.controlPoints.map((point) => ({
			x: blob.currentX + Math.cos(point.angle) * point.radius,
			y: blob.currentY + Math.sin(point.angle) * point.radius,
		}));

		const convexPoints = this.generateConvexHull(points);

		let path = `M ${convexPoints[0].x},${convexPoints[0].y}`;
		for (let i = 0; i < convexPoints.length; i++) {
			const current = convexPoints[i];
			const next = convexPoints[(i + 1) % convexPoints.length];
			const nextNext = convexPoints[(i + 2) % convexPoints.length];

			const cp1x = current.x + (next.x - current.x) * 0.15;
			const cp1y = current.y + (next.y - current.y) * 0.15;
			const cp2x = next.x - (nextNext.x - current.x) * 0.05;
			const cp2y = next.y - (nextNext.y - current.y) * 0.05;

			path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
		}
		path += ' Z';
		return path;
	}

	private generateConvexHull(
		points: Array<{ x: number; y: number }>
	): Array<{ x: number; y: number }> {
		if (points.length < 3) return points;

		const hull: Array<{ x: number; y: number }> = [];
		let startPoint = points[0];
		for (const point of points) {
			if (point.y < startPoint.y || (point.y === startPoint.y && point.x < startPoint.x)) {
				startPoint = point;
			}
		}

		let currentPoint = startPoint;
		do {
			hull.push(currentPoint);
			let nextPoint = points[0];
			for (const point of points) {
				if (nextPoint === currentPoint || this.isLeftTurn(currentPoint, nextPoint, point)) {
					nextPoint = point;
				}
			}
			currentPoint = nextPoint;
		} while (currentPoint !== startPoint && hull.length < points.length);

		return hull;
	}

	private isLeftTurn(
		p1: { x: number; y: number },
		p2: { x: number; y: number },
		p3: { x: number; y: number }
	): boolean {
		return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x) > 0;
	}

	public getBlobs(): ConvexBlob[] {
		return this.blobs;
	}
}
