/**
 * The recordings and videos the Music page lists (TIN-8657).
 * The Music page and the home stream both read this one file.
 */

export interface MusicTrack {
	title: string;
	/** The SoundCloud track page. */
	url: string;
	/** The date as the Music page prints it. */
	date: string;
	/** The same day as an ISO date, for sorting. */
	iso: string;
	note: string;
}

export interface MusicVideo {
	/** The YouTube video id. */
	id: string;
	title: string;
	/**
	 * An ISO date, only where the title itself states the day.
	 * A video with no date is listed on the Music page and left out of the home stream.
	 */
	iso?: string;
}

export const tracks: MusicTrack[] = [
	{
		title: 'Morning Metal 4.22.21 "Sleepish"',
		url: 'https://soundcloud.com/jesssullivan/morning-metal-42221',
		date: 'April 22, 2021',
		iso: '2021-04-22',
		note: 'The usual racket...',
	},
	{
		title: 'Morning Metal 12.17.20',
		url: 'https://soundcloud.com/jesssullivan/morning-metal-121720',
		date: 'December 17, 2020',
		iso: '2020-12-17',
		note: 'Some "freezing-cold-New-Hampshire-Winter" morning metal.',
	},
	{
		title: 'Evening Metal 9.14.20',
		url: 'https://soundcloud.com/jesssullivan/evening-metal-91420',
		date: 'September 14, 2020',
		iso: '2020-09-14',
		note: "Haven't posted any guitar for a bit, here's a recording from this evening.",
	},
];

export const shorts: MusicVideo[] = [
	{ id: 'jcdIMftYGGQ', title: 'Silly Goose Stuff' },
	{ id: 'CcF96vq2dcY', title: 'Sleepy Saturday' },
];

export const videos: MusicVideo[] = [
	{ id: 'HWfSMihJgJw', title: '9 String Amphibiansce' },
	{ id: 'xGdNk7CTTTg', title: 'Drop A for Activities' },
	{ id: 'N2haib_Ttrw', title: 'Twelve a Biggah Numbah Den Nine' },
	{ id: 'JVusudpKTF8', title: 'Morning Metal 04.23.21', iso: '2021-04-23' },
	{ id: 'zCrrzdaBCsw', title: 'Morning Metal 10/28/20', iso: '2020-10-28' },
	{ id: 'nVkjCMmpUII', title: 'Shortest Morning Metal 7 8 20', iso: '2020-07-08' },
	{ id: 's_6pwdzT9ZQ', title: 'Note Feel Good Metal' },
	{ id: 'jrxJHwmtwak', title: 'Shortest Morning Metal 7 8 20', iso: '2020-07-08' },
];
