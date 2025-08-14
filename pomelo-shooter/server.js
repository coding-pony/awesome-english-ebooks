const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: '*' }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Game constants
const GAME_WIDTH = 960;
const GAME_HEIGHT = 600;
const MAX_POMELOS = 10;
const POMELO_MIN_RADIUS = 18;
const POMELO_MAX_RADIUS = 28;
const TICK_RATE = 30; // server ticks per second

// State
/** @type {Map<string, {id: string, name: string, score: number}>} */
const players = new Map();
/** @type {Array<{id: string, x: number, y: number, vx: number, vy: number, radius: number}>} */
let pomelos = [];

function randomBetween(min, max) {
	return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
	return Math.floor(randomBetween(min, max + 1));
}

function spawnPomelo() {
	const radius = randomBetween(POMELO_MIN_RADIUS, POMELO_MAX_RADIUS);
	const speed = randomBetween(0.7, 2.1);
	// Spawn from a random edge moving inward
	const side = randomInt(0, 3); // 0: top, 1: right, 2: bottom, 3: left
	let x = GAME_WIDTH / 2;
	let y = GAME_HEIGHT / 2;
	let vx = 0;
	let vy = 0;
	if (side === 0) {
		x = randomBetween(radius, GAME_WIDTH - radius);
		y = radius + 1;
		vx = randomBetween(-speed, speed);
		vy = speed;
	} else if (side === 1) {
		x = GAME_WIDTH - radius - 1;
		y = randomBetween(radius, GAME_HEIGHT - radius);
		vx = -speed;
		vy = randomBetween(-speed, speed);
	} else if (side === 2) {
		x = randomBetween(radius, GAME_WIDTH - radius);
		y = GAME_HEIGHT - radius - 1;
		vx = randomBetween(-speed, speed);
		vy = -speed;
	} else {
		x = radius + 1;
		y = randomBetween(radius, GAME_HEIGHT - radius);
		vx = speed;
		vy = randomBetween(-speed, speed);
	}
	pomelos.push({ id: uuidv4(), x, y, vx, vy, radius });
}

function maintainPomelos() {
	while (pomelos.length < MAX_POMELOS) {
		spawnPomelo();
	}
}

function updatePomelos(deltaSeconds) {
	for (const p of pomelos) {
		p.x += p.vx * (60 * deltaSeconds); // scale movement vs. nominal 60fps
		p.y += p.vy * (60 * deltaSeconds);
		// Bounce on walls
		if (p.x < p.radius) {
			p.x = p.radius;
			p.vx *= -1;
		} else if (p.x > GAME_WIDTH - p.radius) {
			p.x = GAME_WIDTH - p.radius;
			p.vx *= -1;
		}
		if (p.y < p.radius) {
			p.y = p.radius;
			p.vy *= -1;
		} else if (p.y > GAME_HEIGHT - p.radius) {
			p.y = GAME_HEIGHT - p.radius;
			p.vy *= -1;
		}
	}
}

function getLeaderboard() {
	const list = Array.from(players.values())
		.sort((a, b) => b.score - a.score)
		.slice(0, 10);
	return { top: list, totalPlayers: players.size, at: Date.now() };
}

function emitState() {
	io.emit('state', { pomelos, w: GAME_WIDTH, h: GAME_HEIGHT });
}

let lastTick = Date.now();
setInterval(() => {
	const now = Date.now();
	const deltaSeconds = Math.max(0.001, (now - lastTick) / 1000);
	lastTick = now;
	maintainPomelos();
	updatePomelos(deltaSeconds);
	emitState();
}, 1000 / TICK_RATE);

io.on('connection', (socket) => {
	const playerId = socket.id;
	const defaultName = `玩家${randomInt(100, 999)}`;
	players.set(playerId, { id: playerId, name: defaultName, score: 0 });

	socket.emit('init', {
		id: playerId,
		w: GAME_WIDTH,
		h: GAME_HEIGHT,
		pomelos,
		leaderboard: getLeaderboard()
	});

	io.emit('leaderboard', getLeaderboard());

	socket.on('setName', (name) => {
		const player = players.get(playerId);
		if (!player) return;
		if (typeof name !== 'string') return;
		const trimmed = name.trim().slice(0, 20);
		if (trimmed.length === 0) return;
		player.name = trimmed;
		io.emit('leaderboard', getLeaderboard());
	});

	socket.on('shoot', (payload) => {
		if (!payload || typeof payload.x !== 'number' || typeof payload.y !== 'number') return;
		const x = Math.max(0, Math.min(GAME_WIDTH, payload.x));
		const y = Math.max(0, Math.min(GAME_HEIGHT, payload.y));
		let hitIndex = -1;
		for (let i = 0; i < pomelos.length; i++) {
			const pm = pomelos[i];
			const dx = x - pm.x;
			const dy = y - pm.y;
			if (dx * dx + dy * dy <= pm.radius * pm.radius) {
				hitIndex = i;
				break;
			}
		}
		if (hitIndex !== -1) {
			pomelos.splice(hitIndex, 1);
			const player = players.get(playerId);
			if (player) {
				player.score += 1;
				io.emit('leaderboard', getLeaderboard());
			}
			// Keep the board populated
			maintainPomelos();
		}
	});

	socket.on('disconnect', () => {
		players.delete(playerId);
		io.emit('leaderboard', getLeaderboard());
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Pomelo Shooter server running at http://localhost:${PORT}`);
});