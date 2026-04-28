import { z } from 'zod';
import { LocationPrecisionSchema } from './visibility.js';

export const PlaceSchema = z
	.object({
		label: z.string(),
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180),
		precision: LocationPrecisionSchema,
	})
	.strict();

export type Place = z.infer<typeof PlaceSchema>;
