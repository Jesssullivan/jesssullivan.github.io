const PROFILE_BASE = 'https://raw.githubusercontent.com/Jesssullivan/Jesssullivan/feature/update-script';

export interface Badge {
	text: string;
	color: string;
	logo?: string;
	emoji?: string;
	url?: string;
}

export const TYPING_SVG_URL =
	'https://readme-typing-svg.demolab.com?font=Fira+Code&pause=1000&color=36BCF7&center=true&vCenter=true&width=800&lines=' +
	[
		'Full+Stack+Engineer+%7C+DevSecOps+%7C+Agent+Orchestration+%7C+ML%2FHPC',
		'Chapel+%7C+Haskell+%7C+Python+%7C+TypeScript+%7C+SvelteKit+%7C+Go',
		'C%2B%2B+%7C+R+%7C+Zig+%7C+Nix+%7C+Rust+SIMD+%7C+Futhark+%7C+Emacs+Lisp',
		'Computer+Vision+%7C+Fine-Grained+Classification+%7C+WASM+Inference',
		'K8s+%7C+Ansible+%7C+GitLab+CI+%7C+Apache+Solr+%7C+Bazel',
		'Global+DNS+%7C+k8gb+%7C+CoreDNS+%7C+NAT+Punching+%7C+MetalLB',
		'GIS+%7C+Cartography+%7C+Remote+Sensing+%7C+R+%7C+QGIS',
		'LangChain+%7C+LangGraph+%7C+pgvector+%7C+vLLM+%7C+Custom+Embeddings',
		'Multilocal+Orchestration+%7C+RKE2+%7C+Rancher+%7C+OpenTofu',
		'3D+Printing+%7C+OpenSCAD+%7C+Fusion+360+%7C+Arduino+%7C+RPi',
		'TensorFlow+%7C+NumPy+%7C+Pandas+%7C+Flask+%7C+Docker+%7C+WebAssembly',
		'9-String+Guitar+%7C+12-String+Acoustic+%7C+Rotary+Yamaha+Organ',
		'ACME+Certs+%7C+SAML+%7C+KeePassXC+%7C+SearXNG+%7C+Caddy',
		'Photography+%7C+Mass+Audubon+%7C+Goth+Nights+%7C+Bagel+Baker',
		'Merlin+Sound+ID+%7C+Birder+%7C+Musician+%7C+Baker+%7C+Bard',
	].join(';');

export const CTA_BADGES = [
	{
		label: 'Ask me a question',
		text: 'why are you so cool?',
		color: '36BCF7',
		url: 'https://github.com/Jesssullivan/Jesssullivan/issues/new?title=Why+are+you+so+cool%3F&body=%F0%9F%A4%94+No+but+seriously+though...&labels=question',
	},
	{
		label: 'Hire me',
		text: 'I have budget',
		color: '2ea44f',
		url: 'https://github.com/Jesssullivan/Jesssullivan/issues/new?title=I%27d+like+to+hire+you&body=Hi+Jess%21%0A%0AWe+have+a+role+that+might+interest+you...%0A%0A**Company%3A**+%0A**Role%3A**+%0A**Compensation%3A**+&labels=opportunity',
	},
	{
		label: 'Work for me',
		text: "let's build together",
		color: '8B5CF6',
		url: 'https://github.com/Jesssullivan/Jesssullivan/issues/new?title=I+want+to+work+with+you&body=Hi+Jess%21%0A%0AI+saw+your+work+and+I%27d+love+to+collaborate...%0A%0A**About+me%3A**+%0A**What+I+bring%3A**+&labels=collaboration',
	},
];

export const IDENTITY_BADGES: Badge[] = [
	{ text: 'xoxd.ai', color: '8B5CF6' },
	{ text: 'Coming Soon: tinyland.dev', color: '36BCF7' },
];

export const TECH_FOSS_BADGES: Badge[] = [
	{ text: 'Chapel', color: '3B4D61' },
	{ text: 'Rocky Linux', color: '10B981', logo: 'rockylinux' },
	{ text: 'Apache Solr', color: 'D22128', logo: 'apache' },
	{ text: 'Skeleton UI', color: 'EC4899', logo: 'svelte' },
	{ text: 'SearXNG', color: '2E8B57', logo: 'searxng' },
	{ text: 'KeePassXC', color: '6CAC4D', logo: 'keepassxc' },
	{ text: 'Futhark', color: '5e5086' },
	{ text: 'xCaddy', color: '1F88E5', logo: 'caddy' },
	{ text: 'fft.js', color: '333333', logo: 'javascript' },
	{ text: 'libdns', color: '00695C', logo: 'go' },
	{ text: 'qutebrowser', color: '0D47A1' },
	{ text: 'pytest', color: '0A9EDC', logo: 'pytest' },
	{ text: 'svelte-superforms', color: 'FF3E00', logo: 'svelte' },
	{ text: 'Klipper', color: 'B71C1C' },
];

export const THEMED_IMAGES = {
	githubStats: {
		light: `${PROFILE_BASE}/github-stats.svg`,
		dark: `${PROFILE_BASE}/github-stats-dark.svg`,
		alt: 'GitHub Stats',
	},
	topLangs: {
		light: `${PROFILE_BASE}/top-langs.svg`,
		dark: `${PROFILE_BASE}/top-langs-dark.svg`,
		alt: 'Top Languages',
	},
	snake: {
		light: `${PROFILE_BASE}/github-snake.svg`,
		dark: `${PROFILE_BASE}/github-snake-dark.svg`,
		alt: 'Contribution Snake',
	},
	repoGraph: {
		light: `${PROFILE_BASE}/repo-graph.svg`,
		dark: `${PROFILE_BASE}/repo-graph-dark.svg`,
		alt: 'Repository Similarity Graph',
	},
	streak: {
		light: 'https://streak-stats.demolab.com/?user=Jesssullivan&theme=default&hide_border=true',
		dark: 'https://streak-stats.demolab.com/?user=Jesssullivan&theme=radical&hide_border=true',
		alt: 'GitHub Streak',
	},
	activityGraph: {
		light: 'https://github-readme-activity-graph.vercel.app/graph?username=Jesssullivan&theme=minimal&hide_border=true&area=true',
		dark: 'https://github-readme-activity-graph.vercel.app/graph?username=Jesssullivan&theme=react-dark&hide_border=true&area=true',
		alt: 'Activity Graph',
	},
};

export const CLIENT_BADGES = [
	{ text: 'National Park Service', color: '006B3F' },
	{ text: 'Foundation for Healthy Communities', color: '1976D2' },
	{ text: 'GPRED', color: '5D4037' },
	{ text: 'Northern Border Regional Commission', color: '37474F' },
	{ text: 'Plymouth State University', color: '003DA5' },
	{ text: 'Massage Ithaca', color: '8E24AA' },
	{ text: 'Tetrahedron', color: 'E91E63' },
	{ text: 'Rossel', color: 'FF8F00' },
	{ text: 'STNWL', color: '546E7A' },
];

export const SPONSORING_BADGES: Badge[] = [
	{ text: 'The-Compiler / Freya Bruhin', color: '8B5CF6', logo: 'githubsponsors', url: 'https://github.com/The-Compiler' },
	{ text: 'Xe Iaso / TequaroHQ', color: 'E91E63', logo: 'githubsponsors', url: 'https://github.com/Xe' },
	{ text: 'Skeleton Labs', color: 'EC4899', logo: 'githubsponsors', url: 'https://github.com/skeletonlabs' },
	{ text: 'purpl3F0x', color: '9C27B0', logo: 'githubsponsors', url: 'https://github.com/purpl3F0x' },
	{ text: 'EFF', color: 'EF4444', logo: 'eff', url: 'https://www.eff.org/' },
	{ text: 'Erin in the Morning', color: '36BCF7', url: 'https://www.erininthemorning.com/' },
	{ text: 'The Onion', color: '2EA44F', url: 'https://theonion.com/' },
];
