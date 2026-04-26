export type AS2Context = string | (string | Record<string, string>)[];

export interface AS2Tag {
	type: 'Hashtag' | 'Mention';
	name: string;
	href?: string;
}

export interface AS2Place {
	type: 'Place';
	name: string;
	latitude?: number;
	longitude?: number;
}

export interface BirdSightingData {
	species: string;
	scientificName?: string;
	location?: AS2Place;
	count?: number;
}

export interface BikeRideData {
	distanceMiles: number;
	durationMinutes: number;
	route?: string;
	elevationGainFeet?: number;
}

export interface CodeActivityData {
	linesAdded: number;
	linesRemoved: number;
	commits: number;
	repository: string;
	languages?: string[];
}

export interface SensorMeasurement {
	name: string;
	value: number;
	unit: string;
}

export interface SensorReadingData {
	sensorId: string;
	sensorType: 'environmental' | 'hardware' | 'network';
	measurements: SensorMeasurement[];
}

export interface AS2Object {
	'@context'?: AS2Context;
	id: string;
	type: string;
	published?: string;
	content?: string;
	summary?: string;
	attributedTo?: string;
	tag?: AS2Tag[];
	url?: string;
	'tl:birdSighting'?: BirdSightingData;
	'tl:bikeRide'?: BikeRideData;
	'tl:codeActivity'?: CodeActivityData;
	'tl:sensorReading'?: SensorReadingData;
}

export interface AS2Activity {
	'@context'?: AS2Context;
	id: string;
	type: 'Create' | 'Update' | 'Announce';
	actor: string;
	published: string;
	object: AS2Object;
}

export interface AS2OrderedCollection {
	'@context': AS2Context;
	id: string;
	type: 'OrderedCollection';
	totalItems: number;
	orderedItems: AS2Activity[];
}

export type ActivityKind = 'bird' | 'bike' | 'code' | 'sensor' | 'note';

export interface ResolvedActivity {
	id: string;
	kind: ActivityKind;
	published: Date;
	content: string;
	summary: string;
	tags: string[];
	raw: AS2Activity;
	bird?: BirdSightingData;
	bike?: BikeRideData;
	code?: CodeActivityData;
	sensor?: SensorReadingData;
}
