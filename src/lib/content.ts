// Edit the website text in this file. Keep each paragraph as a separate array item.
export const siteContent = {
	brand: 'cosmoflore',
	navigation: {
		specimens: 'specimens',
		chronicle: 'chronicle',
		about: 'about'
	},
	chronicle: [
		"In a distant future, Earth's scientists and botanists have dedicated themselves to cataloging the flora of the universe to expand humanity's knowledge and preserve these extraordinary lifeforms.",
		"To avoid disturbing fragile alien ecosystems, they observe them only from great distances. Advanced technologies allow them to analyze each organism's molecular composition, internal structure, and biological functions with remarkable precision. From these observations, perfect living clones can be recreated back on Earth.",
		"Using advanced bio-organic engineering, specialized capsules are grown to reproduce each species' native environment, allowing these alien plants to thrive as if they had never left their home world.",
		'Some of these organisms possess astonishing characteristics: impossible colors, mesmerizing geometries, complex symbiotic relationships, and perhaps most captivating of all, scents unlike anything ever experienced on Earth.',
		'These indescribable fragrances have become an obsession for a new generation of master perfumers.'
	],
	about: {
		project: {
			title: 'What is cosmoflore?',
			description:
				'Cosmoflore is an artistic project that began with a question: what would an alien flower smell like? Xenoflora olfacta is the first specimen in this series, created by Mariana Tamashiro, Gigi Minsky, and Louis Badr. From July 27 to 31, 2026, an interactive Xenoflora olfacta capsule will be exhibited at the ARTeFAB International Exhibition at the MIT Media Lab.',
			eventUrl: 'https://fab26.fabevent.org/expo',
			eventLinkLabel: 'fab26.fabevent.org/expo'
		},
		purchase: {
			title: 'Can I purchase a cosmoflore fragrance?',
			description:
				'The Cosmoflore project is ongoing. New plants have been discovered and will soon be revealed to the public. Miniature capsules may become available for purchase in the future. To receive updates, please leave your email address below.',
			emailLabel: 'Email address',
			emailPlaceholder: 'you@example.com',
			submitLabel: 'keep me informed',
			confirmation: 'Thank you — we will keep you informed.'
		}
	},
	specimen: {
		number: '001',
		name: 'xenoflora olfacta',
		imageDescription: 'Xenoflora specimen capsule',
		data: [
			{ label: 'Planetary origin', value: 'X-417b · provisional' },
			{ label: 'Classification', value: 'Crystalline olfactory flora' },
			{ label: 'Native habitat', value: 'Mineral-rich coastal basin' },
			{ label: 'Living conditions', value: '12–18 °C · low oxygen · dim light' },
			{ label: 'Response mechanism', value: 'Oxygen-rich breath' },
			{ label: 'Containment status', value: 'Stable · responsive' }
		],
		description: [
			'A crystalline organism, Xenoflora olfacta, recovered from another world, levitates in quiet containment, oscillating in slow light. When a visitor approaches, it responds to subtle atmospheric changes; the warmth of a body, the disturbance of air. In the presence of oxygen rich breath, it releases volatile crystalline compounds that unfold to the human mind as scent.',
			'The visitor believes they are smelling the organism. Yet the organism is also sensing them.',
			'In this exchange, fragrance becomes more than ornament. It becomes a language, an ephemeral signal carried through air. The work imagines scent as the first bridge between two forms of life: a fleeting moment of mutual chemical recognition between worlds.'
		]
	},
	actions: {
		discover: 'discover',
		comingSoon: 'coming soon',
		closeDetails: 'Close specimen details'
	}
} as const;
