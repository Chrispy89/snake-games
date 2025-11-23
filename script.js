const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameContainer = document.querySelector('.game-container');

const GRID_SIZE = 20;
let tileCountX = 20;
let tileCountY = 20;

let score = 0;
let level = 1;
let gameLoop;
let gameSpeed = 100;

let snake = [];
let food = { x: 0, y: 0 };
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;

// Level Configuration
const levels = [
    { score: 0, speed: 100, color: '#00ff88', food: '#ff0055' },   // Lvl 1: Green (Classic)
    { score: 50, speed: 90, color: '#00ffff', food: '#ffaa00' },   // Lvl 2: Cyan
    { score: 100, speed: 80, color: '#ff00ff', food: '#00ff00' },  // Lvl 3: Magenta
    { score: 150, speed: 70, color: '#ffff00', food: '#0000ff' },  // Lvl 4: Yellow
    { score: 200, speed: 60, color: '#ff0000', food: '#ffffff' }   // Lvl 5: Red (Hard)
];

// Sound Manager
class SoundManager {
    constructor() {
        this.context = null;
    }

    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        // iOS Fix: Resume context on user interaction
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    playTone(frequency, type, duration, volume = 0.1) {
        if (!this.context) return;
        // Ensure context is running (double check for iOS)
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

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
        this.playTone(600 + (level * 50), 'sine', 0.1, 0.1);
        setTimeout(() => this.playTone(800 + (level * 50), 'sine', 0.1, 0.1), 50);
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

    playLevelUpSound() {
        this.playTone(500, 'square', 0.1, 0.1);
        setTimeout(() => this.playTone(700, 'square', 0.1, 0.1), 100);
        setTimeout(() => this.playTone(900, 'square', 0.1, 0.1), 200);
        setTimeout(() => this.playTone(1200, 'square', 0.3, 0.1), 300);
    }
}

const soundManager = new SoundManager();

function resizeGame() {
    const containerWidth = gameContainer.clientWidth;
    const containerHeight = gameContainer.clientHeight;

    tileCountX = Math.floor(containerWidth / GRID_SIZE);
    tileCountY = Math.floor(containerHeight / GRID_SIZE);

    canvas.width = tileCountX * GRID_SIZE;
    canvas.height = tileCountY * GRID_SIZE;

    canvas.style.marginLeft = `${(containerWidth - canvas.width) / 2}px`;
    canvas.style.marginTop = `${(containerHeight - canvas.height) / 2}px`;

    drawGame();
}

function updateLevel() {
    // Find the highest level reached based on score
    let currentLevelConfig = levels[0];
    let newLevel = 1;

    for (let i = 0; i < levels.length; i++) {
        if (score >= levels[i].score) {
            currentLevelConfig = levels[i];
            newLevel = i + 1;
        }
    }

    if (newLevel > level) {
        level = newLevel;
        soundManager.playLevelUpSound();
    }

    levelElement.textContent = level;
    gameSpeed = currentLevelConfig.speed;

    // Update CSS Variables for Colors
    document.documentElement.style.setProperty('--snake-color', currentLevelConfig.color);
    document.documentElement.style.setProperty('--food-color', currentLevelConfig.food);
}

function initGame() {
    resizeGame();
    const startX = Math.floor(tileCountX / 2);
    const startY = Math.floor(tileCountY / 2);

    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
    ];
    score = 0;
    level = 1;
    dx = 1;
    dy = 0;
    nextDx = 1;
    nextDy = 0;
    scoreElement.textContent = score;
    updateLevel(); // Reset colors/speed
    spawnFood();
}

function spawnFood() {
    food.x = Math.floor(Math.random() * tileCountX);
    food.y = Math.floor(Math.random() * tileCountY);

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

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawGame() {
    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    // Get current colors from CSS variables
    const style = getComputedStyle(document.documentElement);
    const snakeColor = style.getPropertyValue('--snake-color').trim();
    const foodColor = style.getPropertyValue('--food-color').trim();

    // Draw Food
    drawRect(food.x, food.y, foodColor, foodColor);

    // Draw Snake
    snake.forEach((segment, index) => {
        const color = index === 0 ? '#ffffff' : snakeColor;
        drawRect(segment.x, segment.y, color, snakeColor);
    });
}

function moveSnake() {
    dx = nextDx;
    dy = nextDy;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
        gameOver();
        return;
    }

    for (let segment of snake) {
        if (head.x === segment.x && head.y === segment.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        soundManager.playEatSound();
        updateLevel(); // Check for level up
        spawnFood();
    } else {
        snake.pop();
    }
}

function gameStep() {
    moveSnake();
    if (!gameOverScreen.classList.contains('hidden')) return;
    drawGame();
    setTimeout(() => {
        if (!gameOverScreen.classList.contains('hidden')) return;
        requestAnimationFrame(gameStep);
    }, gameSpeed);
}

function startGame() {
    // iOS Audio Fix: Init sound manager on user interaction
    soundManager.init();
    soundManager.playStartSound();

    initGame();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameStep();
}

function gameOver() {
    soundManager.playGameOverSound();
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');
}

document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp': if (dy === 0) { nextDx = 0; nextDy = -1; } break;
        case 'ArrowDown': if (dy === 0) { nextDx = 0; nextDy = 1; } break;
        case 'ArrowLeft': if (dx === 0) { nextDx = -1; nextDy = 0; } break;
        case 'ArrowRight': if (dx === 0) { nextDx = 1; nextDy = 0; } break;
    }
});

let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    // iOS Audio Fix: Try to resume context on any touch
    if (soundManager.context && soundManager.context.state === 'suspended') {
        soundManager.context.resume();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0 && dx === 0) { nextDx = 1; nextDy = 0; }
        else if (diffX < 0 && dx === 0) { nextDx = -1; nextDy = 0; }
    } else {
        if (diffY > 0 && dy === 0) { nextDx = 0; nextDy = 1; }
        else if (diffY < 0 && dy === 0) { nextDx = 0; nextDy = -1; }
    }
});

window.addEventListener('resize', () => {
    resizeGame();
    if (!startScreen.classList.contains('hidden') || !gameOverScreen.classList.contains('hidden')) {
        drawGame();
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

resizeGame();
drawGame();
