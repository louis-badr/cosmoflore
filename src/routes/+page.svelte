<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { siteContent } from '$lib/content';

	type Point = { x: number; y: number };
	type Cell = Point & { homeX: number; homeY: number; phase: number; minDistance: number };

	let canvas: HTMLCanvasElement;
	let comingSoon = $state(false);
	let activeTab = $state<'specimens' | 'chronicle' | 'about'>('specimens');
	let discovered = $state(false);
	let interestEmail = $state('');
	let interestSubmitted = $state(false);

	function selectTab(tab: 'specimens' | 'chronicle' | 'about') {
		if (tab !== 'specimens') discovered = false;
		activeTab = tab;
	}

	onMount(() => {
		const maybeContext = canvas.getContext('2d');
		if (!maybeContext) return;
		const context: CanvasRenderingContext2D = maybeContext;

		let width = 0;
		let height = 0;
		let pixelRatio = 1;
		let animationFrame = 0;
		let cells: Cell[] = [];
		let time = 0;
		const pointer = { x: 0, y: 0, active: false };
		const discoveredPalette = ['#c7e5ee', '#acd8e8', '#78bedf'];

		const random = (seed: number) => {
			const value = Math.sin(seed * 91.17) * 43758.5453;
			return value - Math.floor(value);
		};

		const valueNoise = (x: number, y: number, offset: number) => {
			const x0 = Math.floor(x);
			const y0 = Math.floor(y);
			const fadeX = (x - x0) ** 2 * (3 - 2 * (x - x0));
			const fadeY = (y - y0) ** 2 * (3 - 2 * (y - y0));
			const topLeft = random(x0 * 127.1 + y0 * 311.7 + offset);
			const topRight = random((x0 + 1) * 127.1 + y0 * 311.7 + offset);
			const bottomLeft = random(x0 * 127.1 + (y0 + 1) * 311.7 + offset);
			const bottomRight = random((x0 + 1) * 127.1 + (y0 + 1) * 311.7 + offset);
			const top = topLeft + (topRight - topLeft) * fadeX;
			const bottom = bottomLeft + (bottomRight - bottomLeft) * fadeX;
			return top + (bottom - top) * fadeY;
		};

		function makeCells() {
			const spacing = Math.max(150, Math.min(230, Math.sqrt((width * height) / 24)));
			const margin = spacing * 1.35;
			const sampleWidth = width + margin * 2;
			const sampleHeight = height + margin * 2;
			const attempts = Math.ceil((sampleWidth * sampleHeight) / (spacing * spacing)) * 90;
			const next: Cell[] = [];

			for (let attempt = 0; attempt < attempts; attempt += 1) {
				const isLargeAnchor = attempt < 10;
				const seed = isLargeAnchor ? attempt * 997 + 211 : attempt * 17 + 101;
				const homeX = -margin + random(seed) * sampleWidth;
				const homeY = -margin + random(seed + 5) * sampleHeight;
				const density = valueNoise(homeX / (spacing * 2.8), homeY / (spacing * 2.8), 149);
				const localScale = random(seed + 23);
				const minDistance = isLargeAnchor
					? spacing * (1.5 + localScale * 0.65)
					: spacing * (0.2 + density * 0.36 + localScale ** 1.8 * 0.78);
				const hasRoom = next.every(
					(other) => Math.hypot(homeX - other.homeX, homeY - other.homeY) >= Math.max(minDistance, other.minDistance)
				);

				if (hasRoom) {
					next.push({
						x: homeX,
						y: homeY,
						homeX,
						homeY,
						phase: random(seed + 11) * Math.PI * 2,
						minDistance
					});
				}
			}

			cells = next;
		}

		function resize() {
			width = window.innerWidth;
			height = window.innerHeight;
			pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * pixelRatio);
			canvas.height = Math.round(height * pixelRatio);
			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			makeCells();
		}

		function clipPolygon(polygon: Point[], cell: Cell, other: Cell) {
			const result: Point[] = [];
			const nx = other.x - cell.x;
			const ny = other.y - cell.y;
			const midpoint = (other.x * other.x + other.y * other.y - cell.x * cell.x - cell.y * cell.y) / 2;

			for (let index = 0; index < polygon.length; index += 1) {
				const current = polygon[index];
				const previous = polygon[(index + polygon.length - 1) % polygon.length];
				const currentDistance = current.x * nx + current.y * ny - midpoint;
				const previousDistance = previous.x * nx + previous.y * ny - midpoint;
				const currentInside = currentDistance <= 0;
				const previousInside = previousDistance <= 0;

				if (currentInside !== previousInside) {
					const ratio = previousDistance / (previousDistance - currentDistance);
					result.push({
						x: previous.x + (current.x - previous.x) * ratio,
						y: previous.y + (current.y - previous.y) * ratio
					});
				}
				if (currentInside) result.push(current);
			}

			return result;
		}

		function polygonFor(cell: Cell) {
			const margin = 30;
			let polygon: Point[] = [
				{ x: -margin, y: -margin },
				{ x: width + margin, y: -margin },
				{ x: width + margin, y: height + margin },
				{ x: -margin, y: height + margin }
			];

			for (const other of cells) {
				if (other !== cell) polygon = clipPolygon(polygon, cell, other);
				if (polygon.length === 0) break;
			}
			return polygon;
		}

		function cleanPolygon(points: Point[]) {
			const minimumEdgeLength = 18;
			const cleaned = [...points];

			while (cleaned.length > 3) {
				let shortestEdge = Number.POSITIVE_INFINITY;
				let shortestEdgeEnd = -1;

				for (let index = 0; index < cleaned.length; index += 1) {
					const nextIndex = (index + 1) % cleaned.length;
					const edgeLength = Math.hypot(
						cleaned[nextIndex].x - cleaned[index].x,
						cleaned[nextIndex].y - cleaned[index].y
					);

					if (edgeLength < shortestEdge) {
						shortestEdge = edgeLength;
						shortestEdgeEnd = nextIndex;
					}
				}

				if (shortestEdge >= minimumEdgeLength) break;
				cleaned.splice(shortestEdgeEnd, 1);
			}

			return cleaned;
		}

		function roundedPolygon(rawPoints: Point[]) {
			const points = cleanPolygon(rawPoints);
			if (points.length < 3) return;
			const corners = points.map((point, index) => {
				const previous = points[(index + points.length - 1) % points.length];
				const next = points[(index + 1) % points.length];
				const previousLength = Math.hypot(previous.x - point.x, previous.y - point.y);
				const nextLength = Math.hypot(next.x - point.x, next.y - point.y);

				if (previousLength < 0.001 || nextLength < 0.001) return { radius: 0, tangent: 0 };

				const previousX = (previous.x - point.x) / previousLength;
				const previousY = (previous.y - point.y) / previousLength;
				const nextX = (next.x - point.x) / nextLength;
				const nextY = (next.y - point.y) / nextLength;
				const cosine = Math.max(-1, Math.min(1, previousX * nextX + previousY * nextY));
				const tangentScale = Math.tan(Math.acos(cosine) / 2);
				const maxTangent = Math.min(previousLength, nextLength) * 0.42;
				const radius = Math.min(48, maxTangent * tangentScale);

				return {
					radius,
					tangent: tangentScale > 0.0001 ? radius / tangentScale : 0
				};
			});

			const first = points[0];
			const previous = points[points.length - 1];
			const firstLength = Math.hypot(previous.x - first.x, previous.y - first.y);
			const firstTangent = corners[0].tangent;

			context.beginPath();
			context.moveTo(
				first.x + ((previous.x - first.x) / firstLength) * firstTangent,
				first.y + ((previous.y - first.y) / firstLength) * firstTangent
			);
			for (let index = 0; index < points.length; index += 1) {
				const point = points[index];
				const next = points[(index + 1) % points.length];
				context.arcTo(point.x, point.y, next.x, next.y, corners[index].radius);
			}
			context.closePath();
		}

		function draw() {
			time += 0.012;
			context.clearRect(0, 0, width, height);
			if (discovered) {
				context.fillStyle = '#f7f5ef';
				context.fillRect(0, 0, width, height);
			}

			for (const cell of cells) {
				const driftX = Math.cos(time + cell.phase) * 2.5;
				const driftY = Math.sin(time * 0.8 + cell.phase) * 2.5;
				let targetX = cell.homeX + driftX;
				let targetY = cell.homeY + driftY;

				if (pointer.active) {
					const dx = cell.homeX - pointer.x;
					const dy = cell.homeY - pointer.y;
					const distance = Math.max(1, Math.hypot(dx, dy));
					const influence = Math.max(0, 1 - distance / 300) ** 2;
					const maximumShift = Math.min(68, Math.max(16, cell.minDistance * 0.55));
					targetX += (dx / distance) * influence * maximumShift;
					targetY += (dy / distance) * influence * maximumShift;
				}

				cell.x += (targetX - cell.x) * 0.075;
				cell.y += (targetY - cell.y) * 0.075;
			}

			for (let firstIndex = 0; firstIndex < cells.length; firstIndex += 1) {
				for (let secondIndex = firstIndex + 1; secondIndex < cells.length; secondIndex += 1) {
					const first = cells[firstIndex];
					const second = cells[secondIndex];
					const dx = second.x - first.x;
					const dy = second.y - first.y;
					const distance = Math.max(0.001, Math.hypot(dx, dy));
					const safeDistance = Math.max(18, Math.min(first.minDistance, second.minDistance) * 0.55);

					if (distance < safeDistance) {
						const correction = (safeDistance - distance) / 2;
						const normalX = dx / distance;
						const normalY = dy / distance;
						first.x -= normalX * correction;
						first.y -= normalY * correction;
						second.x += normalX * correction;
						second.y += normalY * correction;
					}
				}
			}

			const visibleCells = cells
				.map((cell) => ({ cell, polygon: polygonFor(cell) }))
				.filter(({ polygon }) => polygon.length >= 3);

			for (const { cell, polygon } of visibleCells) {
				const distance = pointer.active ? Math.hypot(cell.x - pointer.x, cell.y - pointer.y) : 999;
				const glow = Math.max(0, 1 - distance / 270);
				roundedPolygon(polygon);
				const tone = (Math.sin(cell.phase) + 1) / 2;
				if (discovered) {
					const paletteIndex = glow > 0.2 ? 2 : tone > 0.5 ? 1 : 0;
					context.fillStyle = discoveredPalette[paletteIndex];
					context.fill();
				}
				context.strokeStyle = discovered ? '#f7f5ef' : '#7896a8';
				context.lineWidth = discovered ? 18 : 1;
				context.lineJoin = 'round';
				context.lineCap = 'round';
				context.stroke();
			}

			animationFrame = requestAnimationFrame(draw);
		}

		function movePointer(event: PointerEvent) {
			pointer.x = event.clientX;
			pointer.y = event.clientY;
			pointer.active = true;
		}

		function leavePointer() {
			pointer.active = false;
		}

		resize();
		window.addEventListener('resize', resize);
		window.addEventListener('pointermove', movePointer, { passive: true });
		window.addEventListener('pointerdown', movePointer, { passive: true });
		window.addEventListener('pointerleave', leavePointer);
		draw();

		return () => {
			cancelAnimationFrame(animationFrame);
			window.removeEventListener('resize', resize);
			window.removeEventListener('pointermove', movePointer);
			window.removeEventListener('pointerdown', movePointer);
			window.removeEventListener('pointerleave', leavePointer);
		};
	});
</script>

<svelte:head>
	<title>{siteContent.brand}</title>
	<meta name="theme-color" content="#071a33" />
</svelte:head>

<main class:discovered={activeTab === 'specimens' && discovered}>
	<div class="night-sky" aria-hidden="true"><i></i><i></i><i></i></div>
	<h1>{siteContent.brand}</h1>
	<nav class="tabs" aria-label="Main sections">
		<button class:active={activeTab === 'specimens'} aria-pressed={activeTab === 'specimens'} onclick={() => selectTab('specimens')}>{siteContent.navigation.specimens}</button>
		<button class:active={activeTab === 'chronicle'} aria-pressed={activeTab === 'chronicle'} onclick={() => selectTab('chronicle')}>{siteContent.navigation.chronicle}</button>
		<button class:active={activeTab === 'about'} aria-pressed={activeTab === 'about'} onclick={() => selectTab('about')}>{siteContent.navigation.about}</button>
	</nav>
	<div class="scene tab-{activeTab}" class:discovered class:coming-soon={comingSoon}>
		<aside>
			{#if activeTab === 'about'}
				<section class="about-block">
					<h3>{siteContent.about.project.title}</h3>
					<p>
						{siteContent.about.project.description}
						{' '}
						<a
							class="about-link"
							href={siteContent.about.project.eventUrl}
							target="_blank"
							rel="noreferrer"
						>{siteContent.about.project.eventLinkLabel}<span aria-hidden="true"> ↗</span></a
						>
					</p>
				</section>
				<section class="about-block">
					<h3>{siteContent.about.purchase.title}</h3>
					<p>{siteContent.about.purchase.description}</p>
					<form
						class="interest-form"
						onsubmit={(event) => {
							event.preventDefault();
							interestSubmitted = true;
						}}
					>
						<div class="interest-row">
							<input
								id="interest-email"
								name="email"
								type="email"
								aria-label={siteContent.about.purchase.emailLabel}
								autocomplete="email"
								placeholder={siteContent.about.purchase.emailPlaceholder}
								bind:value={interestEmail}
								oninput={() => (interestSubmitted = false)}
								required
							/>
							<button type="submit" aria-label={siteContent.about.purchase.submitLabel}>
								<svg viewBox="0 0 24 24" aria-hidden="true">
									<path d="m5 12.5 4.25 4.25L19 7" />
								</svg>
							</button>
						</div>
						{#if interestSubmitted}
							<p class="interest-confirmation" aria-live="polite">{siteContent.about.purchase.confirmation}</p>
						{/if}
					</form>
				</section>
			{:else}
				{#each siteContent.chronicle as paragraph}
					<p>{paragraph}</p>
				{/each}
			{/if}
		</aside>
		<canvas class="voronoi-canvas" bind:this={canvas}></canvas>
		<div class="grain-overlay" aria-hidden="true"></div>
		<div class="card-stage">
			<section class:coming-soon={comingSoon} class="card">
				<div
					class="capsule-image"
					role="img"
					aria-label={siteContent.specimen.imageDescription}
					style={`--capsule-image: url('${base}/images/xenoflora-capsule.png')`}
				></div>
				<p class="specimen-number">specimen {siteContent.specimen.number}</p>
				<h2>{siteContent.specimen.name}</h2>
				<button class="discover" type="button" onclick={() => (discovered = true)}>{siteContent.actions.discover}</button>
				<div class="coming-soon-label">{siteContent.actions.comingSoon}</div>
			</section>
			{#if comingSoon}
				<button class="card-arrow previous" aria-label="Previous card" onclick={() => (comingSoon = false)}>‹</button>
			{:else}
				<button class="card-arrow next" aria-label="Next card" onclick={() => { comingSoon = true; discovered = false; }}>›</button>
			{/if}
		</div>
		<section class="specimen-detail" aria-hidden={!discovered}>
			<p class="detail-label">specimen {siteContent.specimen.number}</p>
			<h3>{siteContent.specimen.name}</h3>
			{#each siteContent.specimen.description as paragraph}
				<p>{paragraph}</p>
			{/each}
			<dl class="specimen-data">
				{#each siteContent.specimen.data as item}
					<div>
						<dt>{item.label}</dt>
						<dd>{item.value}</dd>
					</div>
				{/each}
			</dl>
		</section>
		<button class="close-detail" type="button" aria-label={siteContent.actions.closeDetails} onclick={() => (discovered = false)}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M5 5 19 19M19 5 5 19" />
			</svg>
		</button>
	</div>
</main>
