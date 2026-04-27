import { z } from 'zod';

export const VisibilitySchema = z.enum([
	'VISIBILITY_UNSPECIFIED',
	'VISIBILITY_PRIVATE',
	'VISIBILITY_UNLISTED',
	'VISIBILITY_PUBLIC',
]);

export type Visibility = z.infer<typeof VisibilitySchema>;

export const LocationPrecisionSchema = z.enum([
	'LOCATION_PRECISION_UNSPECIFIED',
	'LOCATION_PRECISION_HIDDEN',
	'LOCATION_PRECISION_REGION',
	'LOCATION_PRECISION_EXACT',
]);

export type LocationPrecision = z.infer<typeof LocationPrecisionSchema>;

export const isExplicitVisibility = (
	v: Visibility,
): v is 'VISIBILITY_PRIVATE' | 'VISIBILITY_UNLISTED' | 'VISIBILITY_PUBLIC' =>
	v !== 'VISIBILITY_UNSPECIFIED';
