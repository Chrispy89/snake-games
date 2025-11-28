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
    { score: 0, speed: 150, color: '#00ff88', food: '#ff0055' },   // Lvl 1: Green (Classic) - Slower start
    { score: 50, speed: 140, color: '#00ffff', food: '#ffaa00' },  // Lvl 2: Cyan
    { score: 100, speed: 130, color: '#ff00ff', food: '#00ff00' }, // Lvl 3: Magenta
    { score: 150, speed: 120, color: '#ffff00', food: '#0000ff' }, // Lvl 4: Yellow
    { score: 200, speed: 110, color: '#ff0000', food: '#ffffff' }, // Lvl 5: Red
    { score: 250, speed: 100, color: '#0088ff', food: '#ff8800' }, // Lvl 6: Blue
    { score: 300, speed: 90, color: '#ff88ff', food: '#88ff00' },  // Lvl 7: Pink
    { score: 350, speed: 80, color: '#88ffff', food: '#ff0088' },  // Lvl 8: Light Cyan
    { score: 400, speed: 70, color: '#ffffff', food: '#8800ff' },  // Lvl 9: White
    { score: 450, speed: 60, color: '#ff4444', food: '#44ff44' }   // Lvl 10: Intense Red (Extreme)
];

// Sound Manager
// SoundManager with Error Handling
class SoundManager {
    constructor() {
        this.context = null;
        this.enabled = true;
    }

    init() {
        try {
            if (!this.context) {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
            }
            // iOS Fix: Resume context on user interaction
            if (this.context.state === 'suspended') {
                this.context.resume().catch(e => console.warn("Audio resume failed:", e));
            }
        } catch (e) {
            console.warn("AudioContext not supported or failed to init:", e);
            this.enabled = false;
        }
    }

    playTone(frequency, type, duration, volume = 0.1) {
        if (!this.enabled || !this.context) return;

        try {
            // Ensure context is running (double check for iOS)
            if (this.context.state === 'suspended') {
                this.context.resume().catch(() => { });
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
        } catch (e) {
            console.warn("Error playing sound:", e);
            // Don't disable globally on single play error, but be safe
        }
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

class LeaderboardManager {
    constructor() {
        this.storageKey = 'snake_leaderboard';
        this.maxScores = 3;
    }

    getScores() {
        const scores = localStorage.getItem(this.storageKey);
        return scores ? JSON.parse(scores) : [];
    }

    isHighScore(score) {
        const scores = this.getScores();
        if (scores.length < this.maxScores) return true;
        return score > scores[scores.length - 1].score;
    }

    addScore(name, score) {
        const scores = this.getScores();
        scores.push({ name, score });
        scores.sort((a, b) => b.score - a.score);
        if (scores.length > this.maxScores) {
            scores.pop();
        }
        localStorage.setItem(this.storageKey, JSON.stringify(scores));
        this.updateDisplay();
    }

    updateDisplay() {
        const listElement = document.getElementById('high-scores-list');
        if (!listElement) return;

        const scores = this.getScores();
        listElement.innerHTML = scores
            .map((s, i) => `<li><span>${i + 1}. ${s.name}</span> <span>${s.score}</span></li>`)
            .join('');
    }
}

const soundManager = new SoundManager();
const leaderboardManager = new LeaderboardManager();

function resizeGame() {
    const containerWidth = gameContainer.clientWidth;
    const containerHeight = gameContainer.clientHeight;

    // Ensure minimum grid size to prevent division by zero or infinite loops
    tileCountX = Math.max(10, Math.floor(containerWidth / GRID_SIZE));
    tileCountY = Math.max(10, Math.floor(containerHeight / GRID_SIZE));

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
    let validPosition = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!validPosition && attempts < maxAttempts) {
        food.x = Math.floor(Math.random() * tileCountX);
        food.y = Math.floor(Math.random() * tileCountY);

        validPosition = true;
        for (let segment of snake) {
            if (segment.x === food.x && segment.y === food.y) {
                validPosition = false;
                break;
            }
        }
        attempts++;
    }

    // If we couldn't find a valid position after maxAttempts, just place it at 0,0 or ignore collision to prevent crash
    if (!validPosition) {
        food.x = 0;
        food.y = 0;
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
    leaderboardManager.updateDisplay(); // Ensure display is updated
    gameStep();
}

function gameOver() {
    soundManager.playGameOverSound();
    finalScoreElement.textContent = score;
    gameOverScreen.classList.remove('hidden');

    const highScoreInput = document.getElementById('high-score-input');
    if (leaderboardManager.isHighScore(score)) {
        highScoreInput.classList.remove('hidden');
        document.getElementById('player-name').focus();
    } else {
        highScoreInput.classList.add('hidden');
    }
}

document.getElementById('save-score-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || 'Anonymous';
    leaderboardManager.addScore(name, score);
    document.getElementById('high-score-input').classList.add('hidden');
    // Optional: Show leaderboard immediately or just restart
    startGame();
});

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
leaderboardManager.updateDisplay(); // Initial load
drawGame();
