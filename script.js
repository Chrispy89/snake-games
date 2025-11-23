const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;

let score = 0;
let gameLoop;
let gameSpeed = 100;

let snake = [];
let food = { x: 0, y: 0 };
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;

// Sound Manager
class SoundManager {
    constructor() {
        this.context = null;
        this.oscillator = null;
        this.gainNode = null;
    }

    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    playTone(frequency, type, duration, volume = 0.1) {
        if (!this.context) return;

        const osc = this.context.createOscillator();
        const gain = this.context.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.context.currentTime);

        gain.gain.setValueAtTime(volume, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.context.destination);

        osc.start();
        osc.stop(this.context.currentTime + duration);
    }

    playEatSound() {
        this.playTone(600, 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(800, 'sine', 0.1, 0.1), 50);
    }

    playGameOverSound() {
        this.playTone(200, 'sawtooth', 0.5, 0.2);
        setTimeout(() => this.playTone(150, 'sawtooth', 0.5, 0.2), 200);
        setTimeout(() => this.playTone(100, 'sawtooth', 0.8, 0.2), 400);
    }

    playStartSound() {
        this.playTone(400, 'square', 0.1, 0.1);
        setTimeout(() => this.playTone(600, 'square', 0.1, 0.1), 100);
        setTimeout(() => this.playTone(800, 'square', 0.2, 0.1), 200);
    }
}

const soundManager = new SoundManager();

function initGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    score = 0;
    dx = 1;
    dy = 0;
    nextDx = 1;
    nextDy = 0;
    scoreElement.textContent = score;
    spawnFood();
}

function spawnFood() {
    food.x = Math.floor(Math.random() * TILE_COUNT);
    food.y = Math.floor(Math.random() * TILE_COUNT);

    // Check if food spawns on snake
    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            spawnFood();
            break;
        }
    }
}

function drawRect(x, y, color, shadowColor) {
    ctx.fillStyle = color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = shadowColor;
    ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
    ctx.shadowBlur = 0;
}

function drawGame() {
    // Clear canvas
    ctx.fillStyle = '#1a1a24'; // Match grid color for clean clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Food
    drawRect(food.x, food.y, '#ff0055', '#ff0055');

    // Draw Snake
    snake.forEach((segment, index) => {
        const color = index === 0 ? '#ffffff' : '#00ff88'; // Head is white, body is green
        drawRect(segment.x, segment.y, color, '#00ff88');
    });
}

function moveSnake() {
    dx = nextDx;
    dy = nextDy;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Wall Collision
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        gameOver();
        return;
    }

    // Self Collision
    for (let segment of snake) {
        if (head.x === segment.x && head.y === segment.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // Check Food Collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        soundManager.playEatSound();
        spawnFood();
        // Increase speed slightly
        if (gameSpeed > 50) gameSpeed -= 1;
    } else {
        snake.pop();
    }
}

function gameStep() {
    moveSnake();
    if (!gameOverScreen.classList.contains('hidden')) return; // Stop if game over
    drawGame();
    setTimeout(() => {
        if (!gameOverScreen.classList.contains('hidden')) return;
        requestAnimationFrame(gameStep);
    }, gameSpeed);
}

function startGame() {
    soundManager.init();
    soundManager.playStartSound();
    initGame();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameSpeed = 100;
    gameStep();
}

function gameOver() {
    soundManager.playGameOverSound();
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

// Input handling
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
            if (dy === 0) { nextDx = 0; nextDy = -1; }
            break;
        case 'ArrowDown':
            if (dy === 0) { nextDx = 0; nextDy = 1; }
            break;
        case 'ArrowLeft':
            if (dx === 0) { nextDx = -1; nextDy = 0; }
            break;
        case 'ArrowRight':
            if (dx === 0) { nextDx = 1; nextDy = 0; }
            break;
    }
});

// Touch handling
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling while playing
}, { passive: false });

document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal swipe
        if (diffX > 0 && dx === 0) {
            nextDx = 1; nextDy = 0; // Right
        } else if (diffX < 0 && dx === 0) {
            nextDx = -1; nextDy = 0; // Left
        }
    } else {
        // Vertical swipe
        if (diffY > 0 && dy === 0) {
            nextDx = 0; nextDy = 1; // Down
        } else if (diffY < 0 && dy === 0) {
            nextDx = 0; nextDy = -1; // Up
        }
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
drawGame();
