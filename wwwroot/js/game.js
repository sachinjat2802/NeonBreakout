// ═══════════════════════════════════════════════════════════════════
//  NEON BREAKOUT — A Modern Paddle & Ball Game
//  Built with .NET Blazor WebAssembly + HTML5 Canvas
// ═══════════════════════════════════════════════════════════════════

const NEON_COLORS = {
    cyan:    '#00FFFF',
    magenta: '#FF00FF',
    yellow:  '#FFE500',
    green:   '#39FF14',
    orange:  '#FF6B00',
    red:     '#FF0044',
    blue:    '#4D4DFF',
    purple:  '#BF00FF',
    pink:    '#FF69B4',
    white:   '#FFFFFF',
};

const BRICK_COLORS = [
    '#FF0044', '#FF6B00', '#FFE500', '#39FF14',
    '#00FFFF', '#4D4DFF', '#BF00FF', '#FF00FF',
];

const POWERUP_TYPES = {
    WIDE:      { color: '#39FF14', icon: '⬌', label: 'WIDE' },
    MULTI:     { color: '#FF00FF', icon: '✦', label: 'MULTI' },
    LASER:     { color: '#FF0044', icon: '↑', label: 'LASER' },
    SLOW:      { color: '#00FFFF', icon: '◷', label: 'SLOW' },
    LIFE:      { color: '#FF69B4', icon: '♥', label: '+1 UP' },
    FIREBALL:  { color: '#FF6B00', icon: '🔥', label: 'FIRE' },
};

// ─── Audio Engine (Web Audio API) ────────────────────────────────
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    play(freq, duration = 0.08, type = 'square', volume = 0.15) {
        if (!this.enabled || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }

    paddleHit()   { this.play(440, 0.1, 'triangle'); }
    wallHit()     { this.play(300, 0.06, 'square', 0.08); }
    brickHit(combo) { this.play(220 + combo * 40, 0.12, 'square', 0.12); }
    powerUp()     { this.play(880, 0.15, 'sine', 0.12); this.play(1100, 0.2, 'sine', 0.08); }
    loseLife()    { this.play(150, 0.4, 'sawtooth', 0.15); }
    levelUp()     { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.play(f, 0.2, 'sine', 0.12), i * 100)); }
    gameOver()    { [400, 350, 300, 200].forEach((f, i) => setTimeout(() => this.play(f, 0.3, 'sawtooth', 0.1), i * 150)); }
    laserShoot()  { this.play(1200, 0.06, 'square', 0.08); }
}

// ─── Particle System ─────────────────────────────────────────────
class Particle {
    constructor(x, y, color, vel, size = 3, life = 1) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = vel.x;
        this.vy = vel.y;
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.decay = 0.02 + Math.random() * 0.02;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 120 * dt; // gravity
        this.life -= this.decay;
        this.size *= 0.995;
    }

    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ─── Trail Point ─────────────────────────────────────────────────
class TrailPoint {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 1;
    }
}

// ─── Laser ───────────────────────────────────────────────────────
class Laser {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 16;
        this.speed = -700;
        this.alive = true;
    }

    update(dt) {
        this.y += this.speed * dt;
        if (this.y + this.height < 0) this.alive = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FF0044';
        ctx.fillStyle = '#FF0044';
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.fillStyle = '#FF8888';
        ctx.fillRect(this.x - 1, this.y, 2, this.height);
        ctx.restore();
    }
}

// ─── Floating PowerUp ───────────────────────────────────────────
class FloatingPowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.config = POWERUP_TYPES[type];
        this.width = 40;
        this.height = 20;
        this.speed = 120;
        this.alive = true;
        this.time = 0;
    }

    update(dt, canvasH) {
        this.y += this.speed * dt;
        this.time += dt;
        if (this.y > canvasH + 30) this.alive = false;
    }

    draw(ctx) {
        ctx.save();
        const pulse = 0.7 + 0.3 * Math.sin(this.time * 6);
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.config.color;

        // Capsule shape
        const r = this.height / 2;
        ctx.fillStyle = this.config.color + '33';
        ctx.strokeStyle = this.config.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height, r);
        ctx.fill();
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = this.config.color;
        ctx.font = 'bold 10px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.config.label, this.x, this.y);
        ctx.restore();
    }
}

// ─── Level Definitions ──────────────────────────────────────────
function generateLevel(level, cols, rows) {
    const bricks = [];
    const patterns = [
        // Level 1: Simple rows
        (r, c) => ({ hp: 1 }),
        // Level 2: Checkerboard
        (r, c) => ((r + c) % 2 === 0) ? { hp: 1 } : null,
        // Level 3: Diamond
        (r, c, maxR, maxC) => {
            const centerR = maxR / 2, centerC = maxC / 2;
            return (Math.abs(r - centerR) / centerR + Math.abs(c - centerC) / centerC <= 1) ? { hp: (r < 2) ? 2 : 1 } : null;
        },
        // Level 4: Fortress
        (r, c, maxR, maxC) => {
            if (r === 0 || r === maxR - 1 || c === 0 || c === maxC - 1) return { hp: 2 };
            if (r === 2 && c > 1 && c < maxC - 2) return { hp: 3 };
            return { hp: 1 };
        },
        // Level 5: Invader
        (r, c, maxR, maxC) => {
            const pattern = [
                '  X     X  ',
                '   X   X   ',
                '  XXXXXXX  ',
                ' XX XXX XX ',
                'XXXXXXXXXXX',
                'X XXXXXXX X',
                'X X     X X',
                '   XX XX   ',
            ];
            if (r >= pattern.length) return null;
            const row = pattern[r];
            const offset = Math.floor((maxC - row.length) / 2);
            const idx = c - offset;
            if (idx < 0 || idx >= row.length) return null;
            return row[idx] === 'X' ? { hp: r < 3 ? 2 : 1 } : null;
        },
        // Level 6+: Random tough
        (r, c) => ({ hp: Math.ceil(Math.random() * 3) }),
    ];

    const patternFn = patterns[Math.min(level - 1, patterns.length - 1)];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const result = patternFn(r, c, rows, cols);
            if (result) {
                bricks.push({
                    row: r,
                    col: c,
                    hp: result.hp,
                    maxHp: result.hp,
                    alive: true,
                    breakAnim: 0,
                });
            }
        }
    }
    return bricks;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN GAME CLASS
// ═══════════════════════════════════════════════════════════════════
class NeonBreakout {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audio = new AudioEngine();
        this.dotnetRef = null;

        // Sizing
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input
        this.keys = {};
        this.mouseX = this.width / 2;
        this.useMouseControl = false;

        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
            if (this.state === 'START' || this.state === 'GAME_OVER') {
                this.startGame();
            } else if (this.state === 'LEVEL_COMPLETE') {
                this.nextLevel();
            } else if (this.state === 'PLAYING' && e.key === ' ' && this.ballStuck) {
                this.launchBall();
            } else if (e.key === 'p' || e.key === 'P') {
                this.togglePause();
            }
            // Init audio on first interaction
            if (!this.audio.ctx) this.audio.init();
        });

        window.addEventListener('keyup', (e) => { this.keys[e.key] = false; });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (this.width / rect.width);
            this.useMouseControl = true;
        });

        canvas.addEventListener('click', () => {
            if (!this.audio.ctx) this.audio.init();
            if (this.state === 'START' || this.state === 'GAME_OVER') {
                this.startGame();
            } else if (this.state === 'LEVEL_COMPLETE') {
                this.nextLevel();
            } else if (this.state === 'PLAYING' && this.ballStuck) {
                this.launchBall();
            }
        });

        // Touch
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            this.mouseX = (e.touches[0].clientX - rect.left) * (this.width / rect.width);
            this.useMouseControl = true;
        }, { passive: false });

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.audio.ctx) this.audio.init();
            if (this.state === 'START' || this.state === 'GAME_OVER') {
                this.startGame();
            } else if (this.state === 'LEVEL_COMPLETE') {
                this.nextLevel();
            } else if (this.state === 'PLAYING' && this.ballStuck) {
                this.launchBall();
            }
        }, { passive: false });

        // Game state
        this.state = 'START';
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('neonBreakoutHighScore') || '0');
        this.lives = 3;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.screenShake = 0;
        this.time = 0;

        // Objects
        this.balls = [];
        this.paddle = null;
        this.bricks = [];
        this.particles = [];
        this.trails = [];
        this.powerUps = [];
        this.lasers = [];
        this.activePowerUps = {};
        this.ballStuck = true;

        // Stars background
        this.stars = Array.from({ length: 80 }, () => ({
            x: Math.random() * 2000,
            y: Math.random() * 2000,
            size: Math.random() * 1.5 + 0.5,
            speed: Math.random() * 20 + 5,
        }));

        // Animation
        this.lastTime = 0;
        this.running = true;
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ─── Game Setup ───────────────────────────────────────────
    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.combo = 0;
        this.maxCombo = 0;
        this.activePowerUps = {};
        this.setupLevel();
    }

    setupLevel() {
        const paddleW = 120;
        const paddleH = 14;
        this.paddle = {
            x: this.width / 2 - paddleW / 2,
            y: this.height - 50,
            width: paddleW,
            baseWidth: paddleW,
            height: paddleH,
            speed: 550,
            color: NEON_COLORS.magenta,
        };

        const ballR = 8;
        this.balls = [{
            x: this.width / 2,
            y: this.paddle.y - ballR,
            radius: ballR,
            dx: 0,
            dy: 0,
            speed: 350 + this.level * 15,
            color: NEON_COLORS.cyan,
            fireball: false,
        }];
        this.ballStuck = true;

        // Bricks
        const cols = Math.min(11, 8 + Math.floor(this.level / 3));
        const rows = Math.min(8, 4 + Math.floor(this.level / 2));
        const brickData = generateLevel(this.level, cols, rows);

        const brickPadding = 6;
        const topOffset = 70;
        const sideMargin = 30;
        const availableW = this.width - sideMargin * 2;
        const brickW = (availableW - (cols - 1) * brickPadding) / cols;
        const brickH = 22;

        this.bricks = brickData.map(b => ({
            ...b,
            x: sideMargin + b.col * (brickW + brickPadding),
            y: topOffset + b.row * (brickH + brickPadding),
            width: brickW,
            height: brickH,
            color: BRICK_COLORS[b.row % BRICK_COLORS.length],
        }));

        this.particles = [];
        this.trails = [];
        this.powerUps = [];
        this.lasers = [];
        this.activePowerUps = {};
        this.combo = 0;
    }

    nextLevel() {
        this.level++;
        this.state = 'PLAYING';
        this.setupLevel();
    }

    launchBall() {
        if (!this.ballStuck || this.balls.length === 0) return;
        this.ballStuck = false;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        this.balls[0].dx = Math.cos(angle) * this.balls[0].speed;
        this.balls[0].dy = Math.sin(angle) * this.balls[0].speed;
    }

    togglePause() {
        if (this.state === 'PLAYING') this.state = 'PAUSED';
        else if (this.state === 'PAUSED') this.state = 'PLAYING';
    }

    // ─── Power-Up Logic ──────────────────────────────────────
    activatePowerUp(type) {
        this.audio.powerUp();
        const duration = 12000;

        switch (type) {
            case 'WIDE':
                this.paddle.width = this.paddle.baseWidth * 1.6;
                this.activePowerUps.WIDE = Date.now() + duration;
                break;
            case 'MULTI':
                const newBalls = [];
                this.balls.forEach(ball => {
                    for (let i = 0; i < 2; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        newBalls.push({
                            ...ball,
                            x: ball.x,
                            y: ball.y,
                            dx: Math.cos(angle) * ball.speed,
                            dy: Math.sin(angle) * ball.speed,
                        });
                    }
                });
                this.balls.push(...newBalls);
                break;
            case 'LASER':
                this.activePowerUps.LASER = Date.now() + duration;
                break;
            case 'SLOW':
                this.balls.forEach(b => {
                    b.dx *= 0.6;
                    b.dy *= 0.6;
                    b.speed *= 0.6;
                });
                this.activePowerUps.SLOW = Date.now() + duration;
                setTimeout(() => {
                    this.balls.forEach(b => {
                        const spd = 350 + this.level * 15;
                        const currentSpd = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
                        if (currentSpd > 0) {
                            b.dx = (b.dx / currentSpd) * spd;
                            b.dy = (b.dy / currentSpd) * spd;
                        }
                        b.speed = spd;
                    });
                }, duration);
                break;
            case 'LIFE':
                this.lives = Math.min(this.lives + 1, 5);
                break;
            case 'FIREBALL':
                this.balls.forEach(b => b.fireball = true);
                this.activePowerUps.FIREBALL = Date.now() + duration;
                setTimeout(() => this.balls.forEach(b => b.fireball = false), duration);
                break;
        }
    }

    // ─── Update ──────────────────────────────────────────────
    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.time += dt;

        // Clean expired power-ups
        const now = Date.now();
        if (this.activePowerUps.WIDE && now > this.activePowerUps.WIDE) {
            this.paddle.width = this.paddle.baseWidth;
            delete this.activePowerUps.WIDE;
        }
        if (this.activePowerUps.LASER && now > this.activePowerUps.LASER) {
            delete this.activePowerUps.LASER;
        }

        // Paddle movement
        const p = this.paddle;
        if (this.useMouseControl) {
            const target = this.mouseX - p.width / 2;
            p.x += (target - p.x) * 0.15;
        } else {
            if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) p.x -= p.speed * dt;
            if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) p.x += p.speed * dt;
        }
        p.x = Math.max(0, Math.min(this.width - p.width, p.x));

        // Laser shooting
        if (this.activePowerUps.LASER && Math.random() < dt * 8) {
            this.lasers.push(new Laser(p.x + p.width * 0.25, p.y));
            this.lasers.push(new Laser(p.x + p.width * 0.75, p.y));
            this.audio.laserShoot();
        }

        // Update lasers
        this.lasers.forEach(l => l.update(dt));
        this.lasers = this.lasers.filter(l => l.alive);

        // Laser-brick collision
        this.lasers.forEach(laser => {
            this.bricks.forEach(brick => {
                if (!brick.alive) return;
                if (laser.x > brick.x && laser.x < brick.x + brick.width &&
                    laser.y < brick.y + brick.height && laser.y + laser.height > brick.y) {
                    laser.alive = false;
                    this.hitBrick(brick);
                }
            });
        });

        // Ball stuck to paddle
        if (this.ballStuck && this.balls.length > 0) {
            this.balls[0].x = p.x + p.width / 2;
            this.balls[0].y = p.y - this.balls[0].radius;
        }

        // Update balls
        this.balls.forEach(ball => {
            if (this.ballStuck) return;

            // Trail
            if (this.trails.length < 500) {
                this.trails.push(new TrailPoint(ball.x, ball.y));
            }

            ball.x += ball.dx * dt;
            ball.y += ball.dy * dt;

            // Wall collisions
            if (ball.x - ball.radius < 0) {
                ball.x = ball.radius;
                ball.dx = Math.abs(ball.dx);
                this.audio.wallHit();
                this.spawnParticles(ball.x, ball.y, NEON_COLORS.cyan, 5);
            }
            if (ball.x + ball.radius > this.width) {
                ball.x = this.width - ball.radius;
                ball.dx = -Math.abs(ball.dx);
                this.audio.wallHit();
                this.spawnParticles(ball.x, ball.y, NEON_COLORS.cyan, 5);
            }
            if (ball.y - ball.radius < 0) {
                ball.y = ball.radius;
                ball.dy = Math.abs(ball.dy);
                this.audio.wallHit();
                this.spawnParticles(ball.x, ball.y, NEON_COLORS.cyan, 5);
            }

            // Paddle collision
            if (ball.dy > 0 &&
                ball.y + ball.radius > p.y &&
                ball.y + ball.radius < p.y + p.height + 10 &&
                ball.x > p.x - 5 &&
                ball.x < p.x + p.width + 5) {

                ball.y = p.y - ball.radius;
                const hitPos = (ball.x - p.x) / p.width;
                const angle = (hitPos - 0.5) * Math.PI * 0.7 - Math.PI / 2;
                const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
                ball.dx = Math.cos(angle) * speed;
                ball.dy = Math.sin(angle) * speed;

                // Ensure upward
                if (ball.dy > 0) ball.dy = -ball.dy;

                this.combo = 0;
                this.audio.paddleHit();
                this.spawnParticles(ball.x, p.y, NEON_COLORS.magenta, 8);
                this.screenShake = 3;
            }

            // Brick collisions
            this.bricks.forEach(brick => {
                if (!brick.alive) return;

                if (ball.x + ball.radius > brick.x &&
                    ball.x - ball.radius < brick.x + brick.width &&
                    ball.y + ball.radius > brick.y &&
                    ball.y - ball.radius < brick.y + brick.height) {

                    if (!ball.fireball) {
                        // Determine collision side
                        const overlapLeft = ball.x + ball.radius - brick.x;
                        const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
                        const overlapTop = ball.y + ball.radius - brick.y;
                        const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);

                        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                        if (minOverlap === overlapTop || minOverlap === overlapBottom) {
                            ball.dy = -ball.dy;
                        } else {
                            ball.dx = -ball.dx;
                        }
                    }

                    this.hitBrick(brick);
                }
            });

            // Bottom - lose ball
            if (ball.y - ball.radius > this.height) {
                ball.dead = true;
            }
        });

        // Remove dead balls
        this.balls = this.balls.filter(b => !b.dead);

        // All balls lost
        if (this.balls.length === 0 && !this.ballStuck) {
            this.lives--;
            this.audio.loseLife();
            this.combo = 0;

            if (this.lives <= 0) {
                this.state = 'GAME_OVER';
                this.audio.gameOver();
                if (this.score > this.highScore) {
                    this.highScore = this.score;
                    localStorage.setItem('neonBreakoutHighScore', this.highScore.toString());
                }
            } else {
                // Reset ball
                this.ballStuck = true;
                this.balls = [{
                    x: p.x + p.width / 2,
                    y: p.y - 8,
                    radius: 8,
                    dx: 0,
                    dy: 0,
                    speed: 350 + this.level * 15,
                    color: NEON_COLORS.cyan,
                    fireball: false,
                }];
                this.activePowerUps = {};
                this.paddle.width = this.paddle.baseWidth;
            }
        }

        // Power-ups
        this.powerUps.forEach(pu => {
            pu.update(dt, this.height);

            // Check paddle collision
            if (pu.alive &&
                pu.x + pu.width / 2 > p.x &&
                pu.x - pu.width / 2 < p.x + p.width &&
                pu.y + pu.height / 2 > p.y &&
                pu.y - pu.height / 2 < p.y + p.height) {
                pu.alive = false;
                this.activatePowerUp(pu.type);
            }
        });
        this.powerUps = this.powerUps.filter(pu => pu.alive);

        // Particles
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.life > 0);

        // Trails
        this.trails.forEach(t => t.life -= 0.04);
        this.trails = this.trails.filter(t => t.life > 0);

        // Screen shake decay
        this.screenShake *= 0.9;
        if (this.screenShake < 0.1) this.screenShake = 0;

        // Level complete?
        if (this.bricks.filter(b => b.alive).length === 0) {
            this.state = 'LEVEL_COMPLETE';
            this.audio.levelUp();
            this.score += this.lives * 500; // Bonus for remaining lives
        }
    }

    hitBrick(brick) {
        brick.hp--;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        const comboMultiplier = 1 + Math.floor(this.combo / 3) * 0.5;
        const points = Math.floor(10 * brick.maxHp * comboMultiplier);
        this.score += points;

        this.audio.brickHit(this.combo);
        this.screenShake = 4 + this.combo * 0.5;
        this.spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 12 + this.combo);

        // Show score popup
        this.particles.push(new ScorePopup(
            brick.x + brick.width / 2,
            brick.y,
            `+${points}`,
            this.combo >= 3 ? NEON_COLORS.yellow : '#FFFFFF'
        ));

        if (brick.hp <= 0) {
            brick.alive = false;
            brick.breakAnim = 1;

            // Maybe drop power-up
            if (Math.random() < 0.15) {
                const types = Object.keys(POWERUP_TYPES);
                const type = types[Math.floor(Math.random() * types.length)];
                this.powerUps.push(new FloatingPowerUp(
                    brick.x + brick.width / 2,
                    brick.y + brick.height / 2,
                    type
                ));
            }
        }
    }

    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 200;
            this.particles.push(new Particle(x, y, color, {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed,
            }, 2 + Math.random() * 3, 0.8 + Math.random() * 0.5));
        }
    }

    // ─── Render ──────────────────────────────────────────────
    draw() {
        const ctx = this.ctx;
        const W = this.width;
        const H = this.height;

        ctx.save();

        // Screen shake
        if (this.screenShake > 0) {
            const sx = (Math.random() - 0.5) * this.screenShake;
            const sy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(sx, sy);
        }

        // Background
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0a0a1a');
        bgGrad.addColorStop(0.5, '#0d0d2b');
        bgGrad.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Animated grid
        this.drawGrid(ctx, W, H);

        // Stars
        this.stars.forEach(star => {
            ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.3 * Math.sin(this.time * star.speed * 0.1)})`;
            ctx.fillRect(star.x % W, star.y % H, star.size, star.size);
        });

        if (this.state === 'START') {
            this.drawStartScreen(ctx, W, H);
        } else if (this.state === 'GAME_OVER') {
            this.drawGameOverScreen(ctx, W, H);
        } else if (this.state === 'LEVEL_COMPLETE') {
            this.drawLevelComplete(ctx, W, H);
        } else {
            // Game elements
            this.drawBricks(ctx);
            this.drawTrails(ctx);
            this.drawBalls(ctx);
            this.drawPaddle(ctx);
            this.drawPowerUps(ctx);
            this.drawLasers(ctx);
            this.drawParticles(ctx);
            this.drawHUD(ctx, W, H);

            if (this.state === 'PAUSED') {
                this.drawPauseOverlay(ctx, W, H);
            }

            if (this.ballStuck) {
                this.drawLaunchPrompt(ctx, W, H);
            }

            // Combo display
            if (this.combo >= 3) {
                this.drawCombo(ctx, W, H);
            }
        }

        ctx.restore();
    }

    drawGrid(ctx, W, H) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        const spacing = 40;
        const offset = (this.time * 10) % spacing;
        for (let x = offset; x < W; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = offset; y < H; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawBricks(ctx) {
        this.bricks.forEach(brick => {
            if (!brick.alive) return;

            ctx.save();
            const dmg = 1 - brick.hp / brick.maxHp;

            ctx.shadowBlur = 10 + (brick.maxHp > 1 ? 5 : 0);
            ctx.shadowColor = brick.color;

            // Brick body
            const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
            grad.addColorStop(0, brick.color + 'CC');
            grad.addColorStop(1, brick.color + '88');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
            ctx.fill();

            // Inner shine
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.roundRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height / 2 - 2, 3);
            ctx.fill();

            // Damage cracks
            if (dmg > 0 && brick.maxHp > 1) {
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1;
                const cx = brick.x + brick.width / 2;
                const cy = brick.y + brick.height / 2;
                for (let i = 0; i < dmg * 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    const a = (i / (dmg * 4)) * Math.PI * 2;
                    ctx.lineTo(cx + Math.cos(a) * brick.width * 0.4, cy + Math.sin(a) * brick.height * 0.5);
                    ctx.stroke();
                }
            }

            // HP indicator for tough bricks
            if (brick.maxHp > 1) {
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.font = 'bold 10px "Orbitron", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(brick.hp.toString(), brick.x + brick.width / 2, brick.y + brick.height / 2);
            }

            ctx.restore();
        });
    }

    drawTrails(ctx) {
        this.trails.forEach(t => {
            ctx.save();
            ctx.globalAlpha = t.life * 0.3;
            ctx.fillStyle = NEON_COLORS.cyan;
            ctx.shadowBlur = 6;
            ctx.shadowColor = NEON_COLORS.cyan;
            ctx.beginPath();
            ctx.arc(t.x, t.y, 3 * t.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    drawBalls(ctx) {
        this.balls.forEach(ball => {
            ctx.save();
            const color = ball.fireball ? NEON_COLORS.orange : ball.color;

            // Outer glow
            ctx.shadowBlur = ball.fireball ? 25 : 15;
            ctx.shadowColor = color;

            // Ball gradient
            const grad = ctx.createRadialGradient(
                ball.x - 2, ball.y - 2, 0,
                ball.x, ball.y, ball.radius
            );
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(0.4, color);
            grad.addColorStop(1, color + '88');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();

            // Fireball effect
            if (ball.fireball) {
                for (let i = 0; i < 3; i++) {
                    this.particles.push(new Particle(
                        ball.x + (Math.random() - 0.5) * 8,
                        ball.y + (Math.random() - 0.5) * 8,
                        Math.random() > 0.5 ? NEON_COLORS.orange : NEON_COLORS.red,
                        { x: (Math.random() - 0.5) * 30, y: Math.random() * 30 },
                        3, 0.4
                    ));
                }
            }

            ctx.restore();
        });
    }

    drawPaddle(ctx) {
        const p = this.paddle;
        ctx.save();

        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;

        const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.5, p.color + 'CC');
        grad.addColorStop(1, p.color + '66');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.width, p.height, 7);
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(p.x + 4, p.y + 2, p.width - 8, p.height / 2 - 1, 5);
        ctx.fill();

        // Laser indicator
        if (this.activePowerUps.LASER) {
            ctx.fillStyle = NEON_COLORS.red;
            ctx.shadowColor = NEON_COLORS.red;
            ctx.beginPath();
            ctx.arc(p.x + p.width * 0.25, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x + p.width * 0.75, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawPowerUps(ctx) {
        this.powerUps.forEach(pu => pu.draw(ctx));
    }

    drawLasers(ctx) {
        this.lasers.forEach(l => l.draw(ctx));
    }

    drawParticles(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    drawHUD(ctx, W, H) {
        ctx.save();

        // Top bar background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, 40);
        ctx.strokeStyle = 'rgba(0,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(W, 40);
        ctx.stroke();

        ctx.shadowBlur = 6;
        ctx.font = '14px "Orbitron", monospace';

        // Score
        ctx.shadowColor = NEON_COLORS.cyan;
        ctx.fillStyle = NEON_COLORS.cyan;
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE`, 15, 17);
        ctx.font = 'bold 16px "Orbitron", monospace';
        ctx.fillText(this.score.toLocaleString(), 15, 34);

        // Level
        ctx.font = '14px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = NEON_COLORS.purple;
        ctx.fillStyle = NEON_COLORS.purple;
        ctx.fillText(`LEVEL ${this.level}`, W / 2, 26);

        // Lives
        ctx.textAlign = 'right';
        ctx.shadowColor = NEON_COLORS.pink;
        ctx.fillStyle = NEON_COLORS.pink;
        for (let i = 0; i < this.lives; i++) {
            ctx.fillText('♥', W - 15 - i * 22, 26);
        }

        // Active power-up indicators
        let puX = 15;
        const puY = H - 20;
        Object.entries(this.activePowerUps).forEach(([type, expiry]) => {
            const remaining = Math.max(0, (expiry - Date.now()) / 1000);
            if (remaining <= 0) return;
            const cfg = POWERUP_TYPES[type];
            if (!cfg) return;

            ctx.font = '10px "Orbitron", monospace';
            ctx.fillStyle = cfg.color;
            ctx.shadowColor = cfg.color;
            ctx.textAlign = 'left';
            ctx.fillText(`${cfg.label} ${remaining.toFixed(1)}s`, puX, puY);
            puX += 100;
        });

        ctx.restore();
    }

    drawCombo(ctx, W, H) {
        ctx.save();
        const scale = 1 + Math.sin(this.time * 8) * 0.05;
        ctx.font = `bold ${20 * scale}px "Orbitron", monospace`;
        ctx.textAlign = 'right';
        ctx.shadowBlur = 20;
        ctx.shadowColor = NEON_COLORS.yellow;
        ctx.fillStyle = NEON_COLORS.yellow;
        ctx.fillText(`${this.combo}x COMBO!`, W - 15, 62);
        ctx.restore();
    }

    drawLaunchPrompt(ctx, W, H) {
        ctx.save();
        const alpha = 0.5 + 0.5 * Math.sin(this.time * 4);
        ctx.globalAlpha = alpha;
        ctx.font = '16px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = NEON_COLORS.white;
        ctx.shadowBlur = 10;
        ctx.shadowColor = NEON_COLORS.cyan;
        ctx.fillText('CLICK or SPACE to Launch', W / 2, H / 2 + 40);
        ctx.restore();
    }

    drawPauseOverlay(ctx, W, H) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);

        ctx.font = 'bold 48px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 30;
        ctx.shadowColor = NEON_COLORS.cyan;
        ctx.fillStyle = NEON_COLORS.cyan;
        ctx.fillText('PAUSED', W / 2, H / 2);

        ctx.font = '16px "Orbitron", monospace';
        ctx.fillStyle = '#AAAAAA';
        ctx.shadowBlur = 0;
        ctx.fillText('Press P to resume', W / 2, H / 2 + 40);
        ctx.restore();
    }

    drawStartScreen(ctx, W, H) {
        ctx.save();

        // Title
        ctx.font = 'bold 52px "Orbitron", monospace';
        ctx.textAlign = 'center';

        // Glow text
        ctx.shadowBlur = 30;
        ctx.shadowColor = NEON_COLORS.cyan;
        ctx.fillStyle = NEON_COLORS.cyan;
        ctx.fillText('NEON', W / 2, H / 2 - 80);

        ctx.shadowColor = NEON_COLORS.magenta;
        ctx.fillStyle = NEON_COLORS.magenta;
        ctx.fillText('BREAKOUT', W / 2, H / 2 - 25);

        // Subtitle
        ctx.font = '14px "Orbitron", monospace';
        ctx.shadowBlur = 10;
        ctx.shadowColor = NEON_COLORS.white;
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText('A Modern Paddle & Ball Game', W / 2, H / 2 + 20);

        // Start prompt
        const alpha = 0.5 + 0.5 * Math.sin(this.time * 4);
        ctx.globalAlpha = alpha;
        ctx.font = '18px "Orbitron", monospace';
        ctx.fillStyle = NEON_COLORS.yellow;
        ctx.shadowColor = NEON_COLORS.yellow;
        ctx.fillText('CLICK or PRESS ANY KEY', W / 2, H / 2 + 70);
        ctx.globalAlpha = 1;

        // High score
        if (this.highScore > 0) {
            ctx.font = '14px "Orbitron", monospace';
            ctx.fillStyle = NEON_COLORS.green;
            ctx.shadowColor = NEON_COLORS.green;
            ctx.fillText(`HIGH SCORE: ${this.highScore.toLocaleString()}`, W / 2, H / 2 + 110);
        }

        // Controls
        ctx.font = '11px "Orbitron", monospace';
        ctx.fillStyle = '#666666';
        ctx.shadowBlur = 0;
        ctx.fillText('← → or Mouse to move  |  SPACE to launch  |  P to pause', W / 2, H - 40);

        ctx.restore();
    }

    drawGameOverScreen(ctx, W, H) {
        ctx.save();

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);

        ctx.font = 'bold 48px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 30;
        ctx.shadowColor = NEON_COLORS.red;
        ctx.fillStyle = NEON_COLORS.red;
        ctx.fillText('GAME OVER', W / 2, H / 2 - 60);

        ctx.font = '20px "Orbitron", monospace';
        ctx.shadowColor = NEON_COLORS.cyan;
        ctx.fillStyle = NEON_COLORS.cyan;
        ctx.fillText(`SCORE: ${this.score.toLocaleString()}`, W / 2, H / 2);

        ctx.font = '16px "Orbitron", monospace';
        ctx.fillStyle = NEON_COLORS.yellow;
        ctx.shadowColor = NEON_COLORS.yellow;
        ctx.fillText(`LEVEL: ${this.level}  |  MAX COMBO: ${this.maxCombo}x`, W / 2, H / 2 + 35);

        if (this.score >= this.highScore && this.score > 0) {
            ctx.font = 'bold 18px "Orbitron", monospace';
            ctx.fillStyle = NEON_COLORS.green;
            ctx.shadowColor = NEON_COLORS.green;
            ctx.fillText('★ NEW HIGH SCORE! ★', W / 2, H / 2 + 75);
        }

        const alpha = 0.5 + 0.5 * Math.sin(this.time * 4);
        ctx.globalAlpha = alpha;
        ctx.font = '16px "Orbitron", monospace';
        ctx.fillStyle = '#AAAAAA';
        ctx.shadowBlur = 0;
        ctx.fillText('Click or press any key to play again', W / 2, H / 2 + 120);

        ctx.restore();
    }

    drawLevelComplete(ctx, W, H) {
        ctx.save();

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);

        ctx.font = 'bold 42px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 30;
        ctx.shadowColor = NEON_COLORS.green;
        ctx.fillStyle = NEON_COLORS.green;
        ctx.fillText('LEVEL COMPLETE!', W / 2, H / 2 - 40);

        ctx.font = '18px "Orbitron", monospace';
        ctx.shadowColor = NEON_COLORS.cyan;
        ctx.fillStyle = NEON_COLORS.cyan;
        ctx.fillText(`Life Bonus: +${this.lives * 500}`, W / 2, H / 2 + 10);

        const alpha = 0.5 + 0.5 * Math.sin(this.time * 4);
        ctx.globalAlpha = alpha;
        ctx.font = '16px "Orbitron", monospace';
        ctx.fillStyle = NEON_COLORS.yellow;
        ctx.shadowColor = NEON_COLORS.yellow;
        ctx.fillText('Click or press any key for next level', W / 2, H / 2 + 60);

        ctx.restore();
    }

    // ─── Game Loop ───────────────────────────────────────────
    loop(timestamp) {
        if (!this.running) return;

        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        if (this.state !== 'START') {
            this.time += dt * 0.5;
        } else {
            this.time += dt;
        }

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    destroy() {
        this.running = false;
    }
}

// ─── Score Popup (extends Particle concept) ──────────────────
class ScorePopup {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1;
        this.maxLife = 1;
        this.vy = -60;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= 0.025;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.font = 'bold 12px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// ─── Blazor Interop ──────────────────────────────────────────
let gameInstance = null;

window.NeonBreakoutInterop = {
    init: function (canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        if (gameInstance) gameInstance.destroy();
        gameInstance = new NeonBreakout(canvas);
    },

    destroy: function () {
        if (gameInstance) {
            gameInstance.destroy();
            gameInstance = null;
        }
    },

    getScore: function () {
        return gameInstance ? gameInstance.score : 0;
    },

    getHighScore: function () {
        return gameInstance ? gameInstance.highScore : 0;
    }
};

