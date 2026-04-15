// ============================================================
// Flappy Beerd — 2D Game Engine (Canvas)
// Progressive difficulty, responsive, touch + keyboard
// ============================================================

export type GameStatus = "idle" | "playing" | "gameover";

export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (score: number) => void;
  onStatusChange: (status: GameStatus) => void;
}

interface Bird {
  x: number;
  y: number;
  velocity: number;
  width: number;
  height: number;
  rotation: number;
  flapFrame: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  gap: number;
  width: number;
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  opacity: number;
}

// ---- Difficulty curve ----
function getSpeed(score: number): number {
  return 2.5 + Math.min(score * 0.15, 3.5);
}

function getPipeGap(score: number): number {
  return Math.max(150 - score * 3, 75);
}

function getPipeInterval(score: number): number {
  return Math.max(140 - score * 4, 70);
}

// ---- Colors ----
const COLORS = {
  sky1: "#4DC9F6",
  sky2: "#1A8FE3",
  ground1: "#DEB887",
  ground2: "#C4A265",
  grass: "#4CAF50",
  pipeBody: "#43A047",
  pipeBorder: "#2E7D32",
  pipeCap: "#66BB6A",
  birdBody: "#FFB300",
  birdWing: "#FF8F00",
  birdEye: "#FFFFFF",
  birdPupil: "#333333",
  birdBeak: "#FF5722",
  scoreText: "#FFFFFF",
  scoreShadow: "rgba(0,0,0,0.4)",
};

export class FlappyEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;
  private animationId: number | null = null;
  private destroyed = false;

  // Game dimensions (logical)
  private W = 400;
  private H = 700;
  private scale = 1;

  // Game objects
  private bird: Bird = this.createBird();
  private pipes: Pipe[] = [];
  private particles: Particle[] = [];
  private clouds: Cloud[] = [];
  private groundX = 0;

  // State
  private score = 0;
  private status: GameStatus = "idle";
  private frameCount = 0;
  private flashAlpha = 0;
  private bestScore = 0;
  private idleTime = 0;

  // Constants
  private readonly GRAVITY = 0.45;
  private readonly FLAP_FORCE = -7.5;
  private readonly GROUND_H = 70;
  private readonly PIPE_WIDTH = 55;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.callbacks = callbacks;
    this.initClouds();
    this.resize();
    // Start a unified render loop that runs in ALL states
    this.startLoop();
  }

  // ---- Lifecycle ----

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const aspect = 400 / 700;
    let w = rect.width;
    let h = rect.height;

    if (w / h > aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }

    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;

    this.scale = (w / this.W) * dpr;
  }

  start() {
    if (this.status === "playing") return;
    this.reset();
    this.status = "playing";
    this.callbacks.onStatusChange("playing");
    // Give initial flap so bird doesn't just fall
    this.bird.velocity = this.FLAP_FORCE;
    this.bird.flapFrame = 8;
  }

  flap() {
    if (this.status === "idle") {
      this.start();
      return;
    }
    if (this.status === "gameover") return;
    this.bird.velocity = this.FLAP_FORCE;
    this.bird.flapFrame = 8;
  }

  restart() {
    this.reset();
    this.status = "idle";
    this.callbacks.onStatusChange("idle");
  }

  destroy() {
    this.destroyed = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getScore() {
    return this.score;
  }

  getStatus() {
    return this.status;
  }

  setBestScore(s: number) {
    this.bestScore = s;
  }

  pause() {
    if (this.status === "playing") {
      this.status = "paused" as GameStatus;
      this.callbacks.onStatusChange("paused" as GameStatus);
    }
  }

  resume() {
    if ((this.status as string) === "paused") {
      this.status = "playing";
      this.callbacks.onStatusChange("playing");
    }
  }

  // ---- Internal ----

  private createBird(): Bird {
    return {
      x: 80,
      y: 300,
      velocity: 0,
      width: 34,
      height: 26,
      rotation: 0,
      flapFrame: 0,
    };
  }

  private reset() {
    this.bird = this.createBird();
    this.pipes = [];
    this.particles = [];
    this.score = 0;
    this.frameCount = 0;
    this.groundX = 0;
    this.flashAlpha = 0;
    this.idleTime = 0;
    this.callbacks.onScoreChange(0);
  }

  private initClouds() {
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      this.clouds.push({
        x: Math.random() * this.W,
        y: 30 + Math.random() * 200,
        width: 60 + Math.random() * 80,
        height: 25 + Math.random() * 20,
        speed: 0.2 + Math.random() * 0.3,
        opacity: 0.3 + Math.random() * 0.4,
      });
    }
  }

  // ---- Single unified loop for all states ----

  private startLoop() {
    const tick = () => {
      if (this.destroyed) return;
      this.animationId = requestAnimationFrame(tick);
      this.update();
      this.draw();
    };
    this.animationId = requestAnimationFrame(tick);
  }

  // ---- Physics ----

  private update() {
    // Always update clouds (ambient animation)
    for (const cloud of this.clouds) {
      cloud.x -= cloud.speed;
      if (cloud.x + cloud.width < 0) {
        cloud.x = this.W + 20;
        cloud.y = 30 + Math.random() * 200;
      }
    }

    if ((this.status as string) === "paused") return;

    if (this.status === "idle") {
      this.idleTime++;
      // Floating bird in idle
      this.bird.y = 280 + Math.sin(this.idleTime * 0.05) * 12;
      // Slow ground scroll in idle
      this.groundX = (this.groundX + 0.5) % 24;
      return;
    }

    if (this.status === "gameover") {
      // Fade flash
      if (this.flashAlpha > 0) this.flashAlpha -= 0.05;
      // Bird falls after death
      if (this.bird.y + this.bird.height < this.H - this.GROUND_H) {
        this.bird.velocity += this.GRAVITY;
        this.bird.y += this.bird.velocity;
        this.bird.rotation = Math.min(this.bird.rotation + 0.1, 1.5);
      }
      return;
    }

    // --- Playing state ---
    this.frameCount++;
    const speed = getSpeed(this.score);

    // Bird physics
    this.bird.velocity += this.GRAVITY;
    this.bird.y += this.bird.velocity;

    // Bird rotation
    if (this.bird.velocity < 0) {
      this.bird.rotation = Math.max(this.bird.rotation - 0.15, -0.5);
    } else {
      this.bird.rotation = Math.min(this.bird.rotation + 0.04, 1.2);
    }

    if (this.bird.flapFrame > 0) this.bird.flapFrame--;

    // Ground scroll
    this.groundX = (this.groundX + speed) % 24;

    // Pipe generation
    const interval = getPipeInterval(this.score);
    if (this.pipes.length === 0 || this.frameCount % Math.round(interval) === 0) {
      this.spawnPipe();
    }

    // Pipe movement + scoring
    for (const pipe of this.pipes) {
      pipe.x -= speed;
      if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
        pipe.passed = true;
        this.score++;
        this.callbacks.onScoreChange(this.score);
        this.spawnScoreParticles();
      }
    }

    this.pipes = this.pipes.filter((p) => p.x + p.width > -10);

    // Particles
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // Collision
    if (this.checkCollision()) {
      this.gameOver();
    }
  }

  private spawnPipe() {
    const gap = getPipeGap(this.score);
    const minTop = 60;
    const maxTop = this.H - this.GROUND_H - gap - 60;
    const topHeight = minTop + Math.random() * (maxTop - minTop);

    this.pipes.push({
      x: this.W + 10,
      topHeight,
      gap,
      width: this.PIPE_WIDTH,
      passed: false,
    });
  }

  private spawnScoreParticles() {
    const colors = ["#FFD700", "#FFA500", "#FF6347", "#00BFFF"];
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: this.bird.x + this.bird.width / 2,
        y: this.bird.y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4 - 1,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 3,
      });
    }
  }

  private checkCollision(): boolean {
    const b = this.bird;
    const bx = b.x + 4;
    const by = b.y + 4;
    const bw = b.width - 8;
    const bh = b.height - 8;

    // Ground / ceiling
    if (by + bh >= this.H - this.GROUND_H || by <= 0) return true;

    // Pipes
    for (const pipe of this.pipes) {
      if (bx < pipe.x + pipe.width && bx + bw > pipe.x) {
        if (by < pipe.topHeight) return true;
        if (by + bh > pipe.topHeight + pipe.gap) return true;
      }
    }

    return false;
  }

  private gameOver() {
    this.status = "gameover";
    this.flashAlpha = 1;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
    this.callbacks.onStatusChange("gameover");
    this.callbacks.onGameOver(this.score);
    // Loop keeps running — bird falls, flash fades
  }

  // ---- Rendering ----

  private draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.scale, this.scale);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.H);
    skyGrad.addColorStop(0, COLORS.sky1);
    skyGrad.addColorStop(1, COLORS.sky2);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Clouds
    this.drawClouds(ctx);

    // Pipes
    for (const pipe of this.pipes) {
      this.drawPipe(ctx, pipe);
    }

    // Ground
    this.drawGround(ctx);

    // Bird
    this.drawBird(ctx);

    // Particles
    this.drawParticles(ctx);

    // Score (playing & gameover)
    if (this.status !== "idle") {
      this.drawScore(ctx);
    }

    // Flash on death
    if (this.flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, this.flashAlpha)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // Idle UI
    if (this.status === "idle") {
      this.drawIdleUI(ctx);
    }

    ctx.restore();
  }

  private drawClouds(ctx: CanvasRenderingContext2D) {
    for (const cloud of this.clouds) {
      ctx.fillStyle = `rgba(255,255,255,${cloud.opacity})`;
      ctx.beginPath();
      ctx.ellipse(
        cloud.x + cloud.width / 2,
        cloud.y,
        cloud.width / 2,
        cloud.height / 2,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        cloud.x + cloud.width * 0.3,
        cloud.y + 5,
        cloud.width * 0.3,
        cloud.height * 0.4,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        cloud.x + cloud.width * 0.7,
        cloud.y + 3,
        cloud.width * 0.25,
        cloud.height * 0.35,
        0, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }

  private drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe) {
    const capH = 24;
    const capOverhang = 4;

    // Top pipe body
    const topGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
    topGrad.addColorStop(0, COLORS.pipeBorder);
    topGrad.addColorStop(0.2, COLORS.pipeBody);
    topGrad.addColorStop(0.8, COLORS.pipeBody);
    topGrad.addColorStop(1, COLORS.pipeBorder);
    ctx.fillStyle = topGrad;
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);

    // Top cap
    ctx.fillStyle = COLORS.pipeCap;
    ctx.fillRect(pipe.x - capOverhang, pipe.topHeight - capH, pipe.width + capOverhang * 2, capH);
    ctx.strokeStyle = COLORS.pipeBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(pipe.x - capOverhang, pipe.topHeight - capH, pipe.width + capOverhang * 2, capH);

    // Bottom pipe body
    const bottomY = pipe.topHeight + pipe.gap;
    const bottomH = this.H - bottomY - this.GROUND_H;
    const botGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
    botGrad.addColorStop(0, COLORS.pipeBorder);
    botGrad.addColorStop(0.2, COLORS.pipeBody);
    botGrad.addColorStop(0.8, COLORS.pipeBody);
    botGrad.addColorStop(1, COLORS.pipeBorder);
    ctx.fillStyle = botGrad;
    ctx.fillRect(pipe.x, bottomY, pipe.width, bottomH);

    // Bottom cap
    ctx.fillStyle = COLORS.pipeCap;
    ctx.fillRect(pipe.x - capOverhang, bottomY, pipe.width + capOverhang * 2, capH);
    ctx.strokeStyle = COLORS.pipeBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(pipe.x - capOverhang, bottomY, pipe.width + capOverhang * 2, capH);
  }

  private drawGround(ctx: CanvasRenderingContext2D) {
    const gY = this.H - this.GROUND_H;

    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, gY, this.W, 12);

    const grdGrad = ctx.createLinearGradient(0, gY + 12, 0, this.H);
    grdGrad.addColorStop(0, COLORS.ground1);
    grdGrad.addColorStop(1, COLORS.ground2);
    ctx.fillStyle = grdGrad;
    ctx.fillRect(0, gY + 12, this.W, this.GROUND_H - 12);

    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    for (let i = -this.groundX; i < this.W + 24; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, gY + 18);
      ctx.lineTo(i + 12, gY + 18);
      ctx.stroke();
    }
  }

  private drawBird(ctx: CanvasRenderingContext2D) {
    const b = this.bird;
    ctx.save();
    ctx.translate(b.x + b.width / 2, b.y + b.height / 2);
    ctx.rotate(b.rotation);

    // Body
    ctx.fillStyle = COLORS.birdBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.width / 2, b.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#E6A800";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wing
    const wingOffset = b.flapFrame > 0 ? -5 : 3;
    ctx.fillStyle = COLORS.birdWing;
    ctx.beginPath();
    ctx.ellipse(-4, wingOffset, 10, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = COLORS.birdEye;
    ctx.beginPath();
    ctx.arc(8, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.birdPupil;
    ctx.beginPath();
    ctx.arc(9.5, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = COLORS.birdBeak;
    ctx.beginPath();
    ctx.moveTo(14, -1);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawScore(ctx: CanvasRenderingContext2D) {
    const text = this.score.toString();
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    ctx.fillStyle = COLORS.scoreShadow;
    ctx.fillText(text, this.W / 2 + 2, 42);

    ctx.fillStyle = COLORS.scoreText;
    ctx.fillText(text, this.W / 2, 40);

    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeText(text, this.W / 2, 40);
  }

  private drawIdleUI(ctx: CanvasRenderingContext2D) {
    // Title
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 3;
    ctx.strokeText("FLAPPY BEERD", this.W / 2, 140);
    ctx.fillText("FLAPPY BEERD", this.W / 2, 140);

    // Subtitle
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#0052FF";
    ctx.fillText("Powered by Base", this.W / 2, 185);

    // Tap hint (pulsing opacity)
    const pulse = 0.5 + Math.sin(this.idleTime * 0.08) * 0.4;
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.fillText("TAP TO PLAY", this.W / 2, 420);

    ctx.font = "14px sans-serif";
    ctx.fillStyle = `rgba(255,255,255,${pulse * 0.6})`;
    ctx.fillText("or press SPACE", this.W / 2, 450);
  }
}
