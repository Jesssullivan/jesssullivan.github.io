export class ScrollHandler {
	private stickiness = 0;
	private lastScrollTime = 0;
	private scrollVelocity = 0;
	private decayRate = 0.92;
	private totalScrollDistance = 0;
	private scrollStartTime = 0;
	private isScrolling = false;
	private scrollDirection = 0;
	private pullForces: Array<{ strength: number; time: number; randomness: number; explosive: boolean }> = [];

	public handleScroll(event: WheelEvent): void {
		const currentTime = Date.now();
		const deltaTime = currentTime - this.lastScrollTime;

		this.scrollDirection = event.deltaY > 0 ? 1 : -1;

		if (!this.isScrolling || deltaTime > 200) {
			this.isScrolling = true;
			this.scrollStartTime = currentTime;
			this.totalScrollDistance = 0;
		}

		this.totalScrollDistance += Math.abs(event.deltaY);

		const scrollSpeed = Math.abs(event.deltaY) / Math.max(deltaTime, 16);
		this.scrollVelocity = this.scrollVelocity * 0.7 + scrollSpeed * 0.3;

		const speedStickiness = Math.min(this.scrollVelocity / 1.5, 2);
		const distanceStickiness = Math.min(this.totalScrollDistance / 400, 2.5);
		const isExplosive = speedStickiness * distanceStickiness > 2.0;

		let targetStickiness = Math.max(speedStickiness, distanceStickiness * 0.9);
		if (isExplosive) targetStickiness = Math.min(targetStickiness * 1.8, 4.0);

		this.stickiness = Math.max(this.stickiness, targetStickiness);

		if (speedStickiness > 0.3 || distanceStickiness > 0.3) {
			let pullStrength = speedStickiness + distanceStickiness * 0.7;
			pullStrength = isExplosive ? Math.min(pullStrength * 2.5, 8.0) : Math.min(pullStrength, 3.0);

			this.pullForces.push({
				strength: pullStrength,
				time: 0,
				randomness: 0.4 + Math.random() * 0.5,
				explosive: isExplosive,
			});

			if (this.pullForces.length > 8) this.pullForces.shift();
		}

		this.lastScrollTime = currentTime;
		this.startDecay();

		setTimeout(() => {
			if (currentTime - this.lastScrollTime >= 200) {
				this.isScrolling = false;
				this.totalScrollDistance = 0;
			}
		}, 200);
	}

	private startDecay(): void {
		const decay = () => {
			this.stickiness *= this.decayRate;
			this.scrollVelocity *= this.decayRate;

			this.pullForces = this.pullForces
				.filter((force) => {
					force.time += 0.016;
					return force.time < (force.explosive ? 3.5 : 2.0);
				})
				.map((force) => ({
					...force,
					strength: force.strength * (force.explosive ? 0.995 : 0.98),
				}));

			if (this.stickiness > 0.01 || this.pullForces.length > 0) {
				requestAnimationFrame(decay);
			} else {
				this.stickiness = 0;
				this.scrollVelocity = 0;
			}
		};
		requestAnimationFrame(decay);
	}

	public getStickiness(): number {
		return this.stickiness;
	}

	public getPullForces(): Array<{ strength: number; time: number; randomness: number; explosive: boolean }> {
		return this.pullForces;
	}
}
