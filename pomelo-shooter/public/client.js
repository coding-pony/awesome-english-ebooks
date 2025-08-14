(() => {
	const socket = io();

	const canvas = document.getElementById('game');
	const ctx = canvas.getContext('2d');

	let worldWidth = 960;
	let worldHeight = 600;
	let pomelos = [];
	let playerId = null;

	function resize() {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	}
	window.addEventListener('resize', resize);
	resize();

	function draw() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Draw a letterbox world area
		const scale = Math.min(canvas.width / worldWidth, canvas.height / worldHeight);
		const offsetX = (canvas.width - worldWidth * scale) / 2;
		const offsetY = (canvas.height - worldHeight * scale) / 2;

		ctx.save();
		ctx.translate(offsetX, offsetY);
		ctx.scale(scale, scale);

		// Playground background
		ctx.fillStyle = '#0f1735';
		ctx.fillRect(0, 0, worldWidth, worldHeight);

		// Grid
		ctx.strokeStyle = 'rgba(255,255,255,0.05)';
		ctx.lineWidth = 1;
		for (let x = 0; x <= worldWidth; x += 40) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, worldHeight);
			ctx.stroke();
		}
		for (let y = 0; y <= worldHeight; y += 40) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(worldWidth, y);
			ctx.stroke();
		}

		// Pomelos
		for (const p of pomelos) {
			// Body
			const gradient = ctx.createRadialGradient(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.1, p.x, p.y, p.radius);
			gradient.addColorStop(0, '#ffe8a6');
			gradient.addColorStop(1, '#ffb347');
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			ctx.fill();
			// Edge
			ctx.strokeStyle = 'rgba(0,0,0,0.25)';
			ctx.lineWidth = 2;
			ctx.stroke();
		}

		ctx.restore();

		requestAnimationFrame(draw);
	}
	requestAnimationFrame(draw);

	// Input: click to shoot
	canvas.addEventListener('click', (ev) => {
		const rect = canvas.getBoundingClientRect();
		const mx = ev.clientX - rect.left;
		const my = ev.clientY - rect.top;
		const scale = Math.min(canvas.width / worldWidth, canvas.height / worldHeight);
		const offsetX = (canvas.width - worldWidth * scale) / 2;
		const offsetY = (canvas.height - worldHeight * scale) / 2;
		const wx = (mx - offsetX) / scale;
		const wy = (my - offsetY) / scale;
		if (wx >= 0 && wx <= worldWidth && wy >= 0 && wy <= worldHeight) {
			socket.emit('shoot', { x: wx, y: wy });
			flashAt(mx, my);
		}
	});

	// Flash effect
	function flashAt(sx, sy) {
		const r = 8;
		const start = performance.now();
		function anim(t) {
			const k = Math.min(1, (t - start) / 200);
			ctx.save();
			ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(sx, sy, r + 30 * k, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
			if (k < 1) requestAnimationFrame(anim);
		}
		requestAnimationFrame(anim);
	}

	// Leaderboard UI
	const leaderList = document.getElementById('leaderList');
	function renderLeaderboard(data) {
		leaderList.innerHTML = '';
		if (!data || !data.top) return;
		for (const item of data.top) {
			const li = document.createElement('li');
			li.textContent = `${item.name}：${item.score}`;
			leaderList.appendChild(li);
		}
	}

	// Name controls
	const nameInput = document.getElementById('nameInput');
	const saveNameButton = document.getElementById('saveName');
	saveNameButton.addEventListener('click', () => {
		const name = nameInput.value.trim();
		if (name.length > 0) socket.emit('setName', name);
	});
	nameInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			saveNameButton.click();
		}
	});

	// Socket events
	socket.on('init', (state) => {
		playerId = state.id;
		worldWidth = state.w;
		worldHeight = state.h;
		pomelos = state.pomelos || [];
		renderLeaderboard(state.leaderboard);
	});

	socket.on('state', (state) => {
		if (Array.isArray(state.pomelos)) pomelos = state.pomelos;
		worldWidth = state.w;
		worldHeight = state.h;
	});

	socket.on('leaderboard', (data) => {
		renderLeaderboard(data);
	});
})();