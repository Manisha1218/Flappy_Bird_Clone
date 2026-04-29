  <script>
        // === CONFIGURATION ===
        const CONFIG = {
            gravity: 0.48,
            flapForce: -8.5,
            pipeSpeed: 2.8,
            pipeGap: 160,
            pipeWidth: 70,
            pipeSpawnInterval: 1700,
            birdSize: 26,
            groundHeight: 70
        };

        // === GAME STATE ===
        let canvas = null;
        let ctx = null;
        let canvasWidth = 0;
        let canvasHeight = 0;
        let gameState = 'start';
        let bird = null;
        let pipes = [];
        let particles = [];
        let trailParticles = [];
        let score = 0;
        let bestScore = 0;
        let lastPipeSpawn = 0;
        let groundOffset = 0;
        let screenShake = 0;
        let animationId = null;
        let reducedMotion = false;

        // === DOM ELEMENTS ===
        const startScreen = document.getElementById('startScreen');
        const gameOverScreen = document.getElementById('gameOverScreen');
        const scoreHud = document.getElementById('scoreHud');
        const finalScoreEl = document.getElementById('finalScore');
        const bestScoreEl = document.getElementById('bestScore');
        const newBestText = document.getElementById('newBestText');

        // === INITIALIZATION ===
        function init() {
            // Check reduced motion preference
            reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            
            // Load best score
            try {
                bestScore = parseInt(localStorage.getItem('flappyBest') || '0', 10);
                if (isNaN(bestScore)) bestScore = 0;
            } catch (e) {
                bestScore = 0;
            }
            bestScoreEl.textContent = bestScore;
            
            // Initialize canvas
            initCanvas();
            
            // Event listeners
            setupEventListeners();
            
            // Start game loop
            requestAnimationFrame(gameLoop);
        }

        function initCanvas() {
            canvas = document.getElementById('gameCanvas');
            const container = canvas.parentElement;
            const rect = container.getBoundingClientRect();
            
            canvasWidth = rect.width;
            canvasHeight = rect.height;
            
            canvas.width = canvasWidth * window.devicePixelRatio;
            canvas.height = canvasHeight * window.devicePixelRatio;
            
            ctx = canvas.getContext('2d');
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }

        function setupEventListeners() {
            document.getElementById('startBtn').addEventListener('click', startGame);
            document.getElementById('restartBtn').addEventListener('click', startGame);
            
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' || e.code === 'ArrowUp') {
                    e.preventDefault();
                    handleInput();
                }
            });
            
            canvas.addEventListener('click', handleInput);
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleInput();
            }, { passive: false });
            
            window.addEventListener('resize', () => {
                initCanvas();
            });
        }

        // === BIRD CLASS ===
        class Bird {
            constructor() {
                this.x = canvasWidth * 0.25;
                this.y = canvasHeight * 0.45;
                this.velocity = 0;
                this.rotation = 0;
                this.size = CONFIG.birdSize;
                this.flapAnimation = 0;
            }

            flap() {
                this.velocity = CONFIG.flapForce;
                this.flapAnimation = 1;
                if (!reducedMotion) {
                    createParticles(this.x, this.y, 6, '#00ff88');
                }
            }

            update() {
                this.velocity += CONFIG.gravity;
                this.velocity = Math.min(this.velocity, 12);
                this.y += this.velocity;
                
                const targetRotation = Math.min(Math.max(this.velocity * 4, -25), 80);
                this.rotation += (targetRotation - this.rotation) * 0.1;
                
                this.flapAnimation *= 0.85;
                
                // Trail particles
                if (!reducedMotion && Math.random() < 0.4 && gameState === 'playing') {
                    trailParticles.push({
                        x: this.x - this.size,
                        y: this.y + (Math.random() - 0.5) * 10,
                        size: Math.random() * 6 + 3,
                        alpha: 0.6,
                        decay: 0.04
                    });
                }
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation * Math.PI / 180);

                // Glow effect
                if (!reducedMotion) {
                    const glowSize = Math.max(1, this.size * 2);
                    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
                    glow.addColorStop(0, 'rgba(0, 255, 136, 0.25)');
                    glow.addColorStop(1, 'rgba(0, 255, 136, 0)');
                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Body
                const bodyGradient = ctx.createRadialGradient(
                    -this.size * 0.3, -this.size * 0.3, 0,
                    0, 0, this.size
                );
                bodyGradient.addColorStop(0, '#00ffbb');
                bodyGradient.addColorStop(0.7, '#00dd99');
                bodyGradient.addColorStop(1, '#00aa77');
                
                ctx.fillStyle = bodyGradient;
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();

                // Inner highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.arc(-this.size * 0.3, -this.size * 0.3, this.size * 0.5, 0, Math.PI * 2);
                ctx.fill();

                // Eye white
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(this.size * 0.35, -this.size * 0.15, this.size * 0.38, 0, Math.PI * 2);
                ctx.fill();

                // Eye pupil
                ctx.fillStyle = '#0a0a0f';
                ctx.beginPath();
                ctx.arc(this.size * 0.45, -this.size * 0.12, this.size * 0.2, 0, Math.PI * 2);
                ctx.fill();

                // Eye shine
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(this.size * 0.38, -this.size * 0.22, this.size * 0.08, 0, Math.PI * 2);
                ctx.fill();

                // Beak
                ctx.fillStyle = '#ffbb00';
                ctx.beginPath();
                ctx.moveTo(this.size * 0.65, this.size * 0.05);
                ctx.lineTo(this.size * 1.2 + this.flapAnimation * 3, this.size * 0.15);
                ctx.lineTo(this.size * 0.65, this.size * 0.35);
                ctx.closePath();
                ctx.fill();

                // Wing (animated)
                const wingY = this.size * 0.2 + Math.sin(Date.now() * 0.015) * 3 + this.flapAnimation * 8;
                ctx.fillStyle = '#00cc88';
                ctx.beginPath();
                ctx.ellipse(-this.size * 0.2, wingY, this.size * 0.5, this.size * 0.3, -0.3, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            getBounds() {
                const hitboxScale = 0.7;
                return {
                    x: this.x - this.size * hitboxScale,
                    y: this.y - this.size * hitboxScale,
                    width: this.size * 2 * hitboxScale,
                    height: this.size * 2 * hitboxScale
                };
            }
        }

        // === PIPE CLASS ===
        class Pipe {
            constructor() {
                const minGapY = 100;
                const maxGapY = canvasHeight - CONFIG.groundHeight - CONFIG.pipeGap - 100;
                this.x = canvasWidth + 20;
                this.gapY = Math.random() * Math.max(1, maxGapY - minGapY) + minGapY;
                this.width = CONFIG.pipeWidth;
                this.passed = false;
            }

            update() {
                this.x -= CONFIG.pipeSpeed;
            }

            draw() {
                const capHeight = 28;
                const capExtra = 8;
                const bottomY = this.gapY + CONFIG.pipeGap;

                // Pipe gradient
                const pipeGradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
                pipeGradient.addColorStop(0, '#1a4a5a');
                pipeGradient.addColorStop(0.3, '#2a6a7a');
                pipeGradient.addColorStop(0.7, '#2a6a7a');
                pipeGradient.addColorStop(1, '#1a4a5a');

                // Top pipe body
                ctx.fillStyle = pipeGradient;
                ctx.fillRect(this.x, 0, this.width, this.gapY - capHeight);
                
                // Top pipe cap
                const capGradient = ctx.createLinearGradient(this.x, 0, this.x + this.width + capExtra * 2, 0);
                capGradient.addColorStop(0, '#2a8a9a');
                capGradient.addColorStop(0.5, '#3abacc');
                capGradient.addColorStop(1, '#2a8a9a');
                ctx.fillStyle = capGradient;
                ctx.fillRect(this.x - capExtra, this.gapY - capHeight, this.width + capExtra * 2, capHeight);

                // Bottom pipe body
                ctx.fillStyle = pipeGradient;
                ctx.fillRect(this.x, bottomY + capHeight, this.width, canvasHeight - bottomY - CONFIG.groundHeight);
                
                // Bottom pipe cap
                ctx.fillStyle = capGradient;
                ctx.fillRect(this.x - capExtra, bottomY, this.width + capExtra * 2, capHeight);

                // Highlight
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.fillRect(this.x + 8, 0, 6, this.gapY - capHeight);
                ctx.fillRect(this.x + 8, bottomY + capHeight, 6, canvasHeight);

                // Edge glow
                if (!reducedMotion) {
                    ctx.fillStyle = 'rgba(0, 255, 136, 0.08)';
                    ctx.fillRect(this.x - 2, this.gapY - capHeight - 5, 3, 10);
                    ctx.fillRect(this.x - 2, bottomY + capHeight - 5, 3, 10);
                }
            }

            getTopBounds() {
                return {
                    x: this.x,
                    y: 0,
                    width: this.width,
                    height: this.gapY
                };
            }

            getBottomBounds() {
                return {
                    x: this.x,
                    y: this.gapY + CONFIG.pipeGap,
                    width: this.width,
                    height: canvasHeight
                };
            }
        }

        // === PARTICLE SYSTEM ===
        function createParticles(x, y, count, color) {
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    size: Math.random() * 6 + 3,
                    color: color,
                    alpha: 1,
                    decay: 0.025 + Math.random() * 0.02
                });
            }
        }

        function updateParticles() {
            particles = particles.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15;
                p.alpha -= p.decay;
                return p.alpha > 0;
            });

            trailParticles = trailParticles.filter(p => {
                p.x -= CONFIG.pipeSpeed * 0.6;
                p.alpha -= p.decay;
                p.size *= 0.98;
                return p.alpha > 0 && p.size > 0.5;
            });
        }

        function drawParticles() {
            // Trail particles
            trailParticles.forEach(p => {
                ctx.fillStyle = `rgba(0, 255, 136, ${p.alpha * 0.4})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fill();
            });

            // Burst particles
            particles.forEach(p => {
                ctx.fillStyle = `rgba(0, 255, 136, ${p.alpha})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // === BACKGROUND RENDERING ===
        function drawBackground() {
            // Sky gradient
            const skyGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
            skyGradient.addColorStop(0, '#050510');
            skyGradient.addColorStop(0.4, '#0a1525');
            skyGradient.addColorStop(0.7, '#102035');
            skyGradient.addColorStop(1, '#152840');
            ctx.fillStyle = skyGradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Stars
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            for (let i = 0; i < 60; i++) {
                const x = ((i * 127.3 + groundOffset * 0.05) % (canvasWidth + 50)) - 25;
                const y = (i * 89.7) % (canvasHeight * 0.55);
                const size = ((i % 4) + 1) * 0.8;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // Distant mountains
            ctx.fillStyle = '#0a1828';
            ctx.beginPath();
            ctx.moveTo(0, canvasHeight * 0.68);
            for (let x = 0; x <= canvasWidth; x += 40) {
                const offset = (x + groundOffset * 0.2) * 0.018;
                const y = canvasHeight * 0.68 - Math.sin(offset) * 35 - Math.cos(offset * 1.3) * 18;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(canvasWidth, canvasHeight);
            ctx.lineTo(0, canvasHeight);
            ctx.fill();

            // Mid mountains
            ctx.fillStyle = '#0f2035';
            ctx.beginPath();
            ctx.moveTo(0, canvasHeight * 0.73);
            for (let x = 0; x <= canvasWidth; x += 25) {
                const offset = (x + groundOffset * 0.4) * 0.025;
                const y = canvasHeight * 0.73 - Math.sin(offset) * 25 - Math.cos(offset * 1.8) * 12;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(canvasWidth, canvasHeight);
            ctx.lineTo(0, canvasHeight);
            ctx.fill();

            // City silhouette
            ctx.fillStyle = '#0a1520';
            for (let i = 0; i < 15; i++) {
                const x = ((i * 45 + groundOffset * 0.3) % (canvasWidth + 100)) - 50;
                const h = 40 + (i * 17) % 60;
                ctx.fillRect(x, canvasHeight - CONFIG.groundHeight - h, 25, h);
                
                // Windows
                if (!reducedMotion) {
                    ctx.fillStyle = `rgba(0, 255, 136, ${0.1 + (i % 3) * 0.05})`;
                    for (let wy = canvasHeight - CONFIG.groundHeight - h + 8; wy < canvasHeight - CONFIG.groundHeight - 8; wy += 12) {
                        ctx.fillRect(x + 5, wy, 4, 6);
                        ctx.fillRect(x + 14, wy, 4, 6);
                    }
                    ctx.fillStyle = '#0a1520';
                }
            }
        }

        function drawGround() {
            const groundY = canvasHeight - CONFIG.groundHeight;

            // Ground base
            const groundGradient = ctx.createLinearGradient(0, groundY, 0, canvasHeight);
            groundGradient.addColorStop(0, '#0f3028');
            groundGradient.addColorStop(0.15, '#0a2820');
            groundGradient.addColorStop(1, '#051812');
            ctx.fillStyle = groundGradient;
            ctx.fillRect(0, groundY, canvasWidth, CONFIG.groundHeight);

            // Ground top glow line
            const lineGradient = ctx.createLinearGradient(0, groundY, canvasWidth, groundY);
            lineGradient.addColorStop(0, 'rgba(0, 255, 136, 0.3)');
            lineGradient.addColorStop(0.5, 'rgba(0, 255, 136, 0.8)');
            lineGradient.addColorStop(1, 'rgba(0, 255, 136, 0.3)');
            ctx.fillStyle = lineGradient;
            ctx.fillRect(0, groundY, canvasWidth, 3);

            // Ground pattern
            ctx.fillStyle = 'rgba(0, 255, 136, 0.06)';
            const patternOffset = groundOffset % 50;
            for (let x = -patternOffset; x < canvasWidth + 50; x += 50) {
                ctx.beginPath();
                ctx.moveTo(x, groundY + 15);
                ctx.lineTo(x + 25, groundY + CONFIG.groundHeight);
                ctx.lineTo(x - 25, groundY + CONFIG.groundHeight);
                ctx.closePath();
                ctx.fill();
            }
        }

        // === COLLISION DETECTION ===
        function checkCollision() {
            if (!bird) return false;
            
            const birdBounds = bird.getBounds();
            const groundY = canvasHeight - CONFIG.groundHeight;

            // Ground/ceiling collision
            if (bird.y + bird.size * 0.7 > groundY || bird.y - bird.size * 0.7 < 0) {
                return true;
            }

            // Pipe collision
            for (const pipe of pipes) {
                if (rectIntersect(birdBounds, pipe.getTopBounds()) || 
                    rectIntersect(birdBounds, pipe.getBottomBounds())) {
                    return true;
                }
            }

            return false;
        }

        function rectIntersect(a, b) {
            return a.x < b.x + b.width &&
                   a.x + a.width > b.x &&
                   a.y < b.y + b.height &&
                   a.y + a.height > b.y;
        }

        // === SCORE ===
        function checkScore() {
            if (!bird) return;
            
            for (const pipe of pipes) {
                if (!pipe.passed && pipe.x + pipe.width < bird.x - bird.size) {
                    pipe.passed = true;
                    score++;
                    scoreHud.textContent = score;
                    scoreHud.classList.add('pop');
                    setTimeout(() => scoreHud.classList.remove('pop'), 150);
                    if (!reducedMotion) {
                        createParticles(bird.x, bird.y - 20, 12, '#00ff88');
                    }
                }
            }
        }

        // === GAME STATE MANAGEMENT ===
        function startGame() {
            gameState = 'playing';
            bird = new Bird();
            pipes = [];
            particles = [];
            trailParticles = [];
            score = 0;
            lastPipeSpawn = performance.now();
            groundOffset = 0;
            screenShake = 0;
            scoreHud.textContent = '0';
            startScreen.classList.add('hidden');
            gameOverScreen.classList.add('hidden');
            newBestText.classList.add('hidden');
        }

        function gameOver() {
            gameState = 'gameover';
            screenShake = reducedMotion ? 0 : 18;
            
            if (!reducedMotion && bird) {
                createParticles(bird.x, bird.y, 25, '#ff3366');
            }

            const isNewBest = score > bestScore;
            if (isNewBest) {
                bestScore = score;
                try {
                    localStorage.setItem('flappyBest', bestScore.toString());
                } catch (e) {}
            }

            finalScoreEl.textContent = score;
            bestScoreEl.textContent = bestScore;
            
            if (isNewBest && score > 0) {
                newBestText.classList.remove('hidden');
            } else {
                newBestText.classList.add('hidden');
            }

            setTimeout(() => {
                gameOverScreen.classList.remove('hidden');
            }, 400);
        }

        function handleInput() {
            if (gameState === 'start') {
                startGame();
            } else if (gameState === 'playing' && bird) {
                bird.flap();
            }
        }

        // === MAIN GAME LOOP ===
        function gameLoop(timestamp) {
            // Clear canvas
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            // Apply screen shake
            if (screenShake > 0.5) {
                ctx.save();
                ctx.translate(
                    (Math.random() - 0.5) * screenShake,
                    (Math.random() - 0.5) * screenShake
                );
                screenShake *= 0.88;
            }

            // Draw background
            drawBackground();

            // Update ground offset
            if (gameState === 'playing') {
                groundOffset += CONFIG.pipeSpeed;
            }

            // Game logic
            if (gameState === 'playing') {
                // Spawn pipes
                if (timestamp - lastPipeSpawn > CONFIG.pipeSpawnInterval) {
                    pipes.push(new Pipe());
                    lastPipeSpawn = timestamp;
                }

                // Update bird
                if (bird) {
                    bird.update();
                }

                // Update pipes
                pipes.forEach(pipe => pipe.update());
                pipes = pipes.filter(pipe => pipe.x + pipe.width > -50);

                // Check collision
                if (checkCollision()) {
                    gameOver();
                }

                // Check score
                checkScore();
            }

            // Draw pipes (behind bird)
            pipes.forEach(pipe => pipe.draw());

            // Draw ground
            drawGround();

            // Update and draw particles
            if (!reducedMotion) {
                updateParticles();
                drawParticles();
            }

            // Draw bird
            if (bird) {
                bird.draw();
            } else if (gameState === 'start') {
                // Draw demo bird floating
                drawDemoBird();
            }

            // Reset screen shake transform
            if (screenShake > 0.5) {
                ctx.restore();
            }

            animationId = requestAnimationFrame(gameLoop);
        }

        // Demo bird for start screen
        let demoBirdY = 0;
        let demoBirdTime = 0;
        
        function drawDemoBird() {
            demoBirdTime += 0.03;
            const baseY = canvasHeight * 0.45;
            demoBirdY = baseY + Math.sin(demoBirdTime) * 25;
            
            ctx.save();
            ctx.translate(canvasWidth * 0.35, demoBirdY);
            
            // Glow
            if (!reducedMotion) {
                const glowSize = Math.max(1, CONFIG.birdSize * 2);
                const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
                glow.addColorStop(0, 'rgba(0, 255, 136, 0.2)');
                glow.addColorStop(1, 'rgba(0, 255, 136, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
                ctx.fill();
            }

            // Body
            const bodyGradient = ctx.createRadialGradient(
                -CONFIG.birdSize * 0.3, -CONFIG.birdSize * 0.3, 0,
                0, 0, CONFIG.birdSize
            );
            bodyGradient.addColorStop(0, '#00ffbb');
            bodyGradient.addColorStop(1, '#00aa77');
            ctx.fillStyle = bodyGradient;
            ctx.beginPath();
            ctx.arc(0, 0, CONFIG.birdSize, 0, Math.PI * 2);
            ctx.fill();

            // Eye
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(CONFIG.birdSize * 0.35, -CONFIG.birdSize * 0.15, CONFIG.birdSize * 0.38, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0a0a0f';
            ctx.beginPath();
            ctx.arc(CONFIG.birdSize * 0.45, -CONFIG.birdSize * 0.12, CONFIG.birdSize * 0.2, 0, Math.PI * 2);
            ctx.fill();

            // Beak
            ctx.fillStyle = '#ffbb00';
            ctx.beginPath();
            ctx.moveTo(CONFIG.birdSize * 0.65, CONFIG.birdSize * 0.05);
            ctx.lineTo(CONFIG.birdSize * 1.2, CONFIG.birdSize * 0.15);
            ctx.lineTo(CONFIG.birdSize * 0.65, CONFIG.birdSize * 0.35);
            ctx.closePath();
            ctx.fill();

            // Wing
            const wingY = CONFIG.birdSize * 0.2 + Math.sin(demoBirdTime * 3) * 5;
            ctx.fillStyle = '#00cc88';
            ctx.beginPath();
            ctx.ellipse(-CONFIG.birdSize * 0.2, wingY, CONFIG.birdSize * 0.5, CONFIG.birdSize * 0.3, -0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // Start the game
        init();
    </script>
