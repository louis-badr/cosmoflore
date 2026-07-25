<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';

	type Point = { x: number; y: number };
	type Cell = Point & { homeX: number; homeY: number; phase: number; minDistance: number };

	let canvas: HTMLCanvasElement;
	let comingSoon = $state(false);
	let activeTab = $state<'specimens' | 'chronicle' | 'about'>('specimens');
	let discovered = $state(false);

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
			const spacing = Math.max(128, Math.min(190, Math.sqrt((width * height) / 32)));
			const margin = spacing * 1.35;
			const sampleWidth = width + margin * 2;
			const sampleHeight = height + margin * 2;
			const attempts = Math.ceil((sampleWidth * sampleHeight) / (spacing * spacing)) * 90;
			const next: Cell[] = [];

			for (let attempt = 0; attempt < attempts; attempt += 1) {
				const seed = attempt * 17 + 101;
				const homeX = -margin + random(seed) * sampleWidth;
				const homeY = -margin + random(seed + 5) * sampleHeight;
				const density = valueNoise(homeX / (spacing * 2.8), homeY / (spacing * 2.8), 149);
				const minDistance = spacing * (0.48 + density * 0.42);
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

		function roundedPolygon(points: Point[]) {
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
			context.fillStyle = '#f7f5ef';
			context.fillRect(0, 0, width, height);

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
					targetX += (dx / distance) * influence * 68;
					targetY += (dy / distance) * influence * 68;
				}

				cell.x += (targetX - cell.x) * 0.075;
				cell.y += (targetY - cell.y) * 0.075;
			}

			for (const cell of cells) {
				const polygon = polygonFor(cell);
				if (polygon.length < 3) continue;

				const distance = pointer.active ? Math.hypot(cell.x - pointer.x, cell.y - pointer.y) : 999;
				const glow = Math.max(0, 1 - distance / 270);
				roundedPolygon(polygon);
				const tone = (Math.sin(cell.phase) + 1) / 2;
				const baseRed = 191 + tone * 16;
				const baseGreen = 229 - tone;
				const baseBlue = 234 + tone * 10;
				context.fillStyle = `rgb(${Math.round(baseRed + (120 - baseRed) * glow)}, ${Math.round(baseGreen + (190 - baseGreen) * glow)}, ${Math.round(baseBlue + (223 - baseBlue) * glow)})`;
				context.fill();
				context.strokeStyle = '#f7f5ef';
				context.lineWidth = 18;
				context.lineJoin = 'round';
				context.lineCap = 'round';
				context.stroke();
			}

			animationFrame = requestAnimationFrame(draw);
		}

		function movePointer(event: PointerEvent) {
			const bounds = canvas.getBoundingClientRect();
			pointer.x = (event.clientX - bounds.left) * (width / bounds.width);
			pointer.y = (event.clientY - bounds.top) * (height / bounds.height);
			pointer.active = true;
		}

		function leavePointer() {
			pointer.active = false;
		}

		resize();
		window.addEventListener('resize', resize);
		canvas.addEventListener('pointermove', movePointer, { passive: true });
		canvas.addEventListener('pointerdown', movePointer, { passive: true });
		canvas.addEventListener('pointerleave', leavePointer);
		draw();

		return () => {
			cancelAnimationFrame(animationFrame);
			window.removeEventListener('resize', resize);
			canvas.removeEventListener('pointermove', movePointer);
			canvas.removeEventListener('pointerdown', movePointer);
			canvas.removeEventListener('pointerleave', leavePointer);
		};
	});
</script>

<svelte:head>
	<title></title>
	<meta name="theme-color" content="#071a33" />
</svelte:head>

<main class:discovered>
	<div class="night-sky" aria-hidden="true"><i></i><i></i><i></i></div>
	<h1>cosmoflore</h1>
	<nav class="tabs" aria-label="Main sections">
		<button class:active={activeTab === 'specimens'} aria-pressed={activeTab === 'specimens'} onclick={() => (activeTab = 'specimens')}>specimens</button>
		<button class:active={activeTab === 'chronicle'} aria-pressed={activeTab === 'chronicle'} onclick={() => (activeTab = 'chronicle')}>chronicle</button>
		<button class:active={activeTab === 'about'} aria-pressed={activeTab === 'about'} onclick={() => (activeTab = 'about')}>about</button>
	</nav>
	<div class="scene tab-{activeTab}" class:discovered class:coming-soon={comingSoon}>
		<aside>
			<p>In a distant future, Earth's scientists and botanists have dedicated themselves to cataloging the flora of the universe to expand humanity's knowledge and preserve these extraordinary lifeforms.</p>
			<p>To avoid disturbing fragile alien ecosystems, they observe them only from great distances. Advanced technologies allow them to analyze each organism's molecular composition, internal structure, and biological functions with remarkable precision. From these observations, perfect living clones can be recreated back on Earth.</p>
			<p>Using advanced bio-organic engineering, specialized capsules are grown to reproduce each species' native environment, allowing these alien plants to thrive as if they had never left their home world.</p>
			<p>Some of these organisms possess astonishing characteristics: impossible colors, mesmerizing geometries, complex symbiotic relationships, and perhaps most captivating of all, scents unlike anything ever experienced on Earth.</p>
			<p>These indescribable fragrances have become an obsession for a new generation of master perfumers.</p>
		</aside>
		<canvas class="voronoi-canvas" bind:this={canvas}></canvas>
		<div class="card-stage">
			<section class:coming-soon={comingSoon} class="card">
				<div
					class="capsule-image"
					role="img"
					aria-label="Xenoflora specimen capsule"
					style={`--capsule-image: url('${base}/images/xenoflora-capsule.png')`}
				></div>
				<h2>xenoflora olfacta</h2>
				<button class="discover" type="button" onclick={() => (discovered = true)}>discover</button>
				<div class="coming-soon-label">coming soon</div>
			</section>
			{#if comingSoon}
				<button class="card-arrow previous" aria-label="Previous card" onclick={() => (comingSoon = false)}>‹</button>
			{:else}
				<button class="card-arrow next" aria-label="Next card" onclick={() => { comingSoon = true; discovered = false; }}>›</button>
			{/if}
		</div>
		<section class="specimen-detail" aria-hidden={!discovered}>
			<p class="detail-label">specimen 001</p>
			<h3>xenoflora olfacta</h3>
			<p>This specimen is a living reconstruction created by Earth’s scientists from observations made across interstellar distance. It was the first alien organism to capture the attention of master perfumers, transforming a botanical experiment into the beginning of an entirely new olfactory discipline.</p>
			<p>Unlike terrestrial organisms, Xenoflora olfacta is a silicon-based lifeform. Its translucent tissues grow through mineral-like lattices that store light, regulate temperature, and sustain the delicate chemistry of its fragrance.</p>
			<p>Its scent is distinctly aquatic: cool, saline, and luminous, with an unfamiliar mineral depth that recalls an ocean beneath another sky.</p>
			<button class="close-detail" type="button" onclick={() => (discovered = false)}>close</button>
		</section>
	</div>
</main>
