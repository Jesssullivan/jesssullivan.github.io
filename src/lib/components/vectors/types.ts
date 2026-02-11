export interface ConvexBlob {
	baseX: number;
	baseY: number;
	currentX: number;
	currentY: number;
	velocityX: number;
	velocityY: number;
	size: number;
	elasticity: number;
	viscosity: number;
	phase: number;
	speed: number;
	color: string;
	gradientId: string;
	intensity: number;
	scrollAffinity: number;
	fluidMass: number;
	controlPoints: Array<{
		radius: number;
		angle: number;
		targetRadius: number;
		baseRadius: number;
	}>;
	controlVelocities: Array<{
		radialVelocity: number;
		angularVelocity: number;
	}>;
	driftAngle: number;
	driftSpeed: number;
	territoryRadius: number;
	territoryX: number;
	territoryY: number;
	personalSpace: number;
	repulsionStrength: number;
	lastRepulsionTime: number;
	chaosLevel: number;
	wallBounceCount: number;
	lastBounceTime: number;
}

export interface ColorDefinition {
	color: string;
	scrollAffinity: number;
}
