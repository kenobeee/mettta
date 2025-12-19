import RAPIER from '@dimforge/rapier2d-compat';

import bgUrl from '../assets/bg.png';
import tileUrl from '../assets/tile.png';

import { Camera } from './graphics/camera';
import { SpriteAnimator } from './graphics/spriteAnimator';
import { TileRenderer } from './graphics/tileRenderer';
import { InputManager } from './input';
import { Facing, Frame } from './types';
import { loadFrames, loadImage } from './utils/assets';
import { Player } from './world/player';

const idleImports = import.meta.glob('../assets/player/idle/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const runningImports = import.meta.glob('../assets/player/running/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const walkingImports = import.meta.glob('../assets/player/walking/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});

// Central game orchestrator: loads assets, wires physics, input, render.
export class Game {
  private readonly worldSize = 60; // 60m x 60m
  private readonly worldHalf = this.worldSize / 2;
  private readonly worldHeight = this.worldSize;
  private readonly gravity = { x: 0, y: -12 };
  private readonly groundThickness = 1;
  private readonly wallThickness = 1;
  private readonly groundY = -this.worldHalf + this.groundThickness / 2;
  private readonly ceilingY = this.worldHalf - this.wallThickness / 2;
  private readonly leftX = -this.worldHalf + this.wallThickness / 2;
  private readonly rightX = this.worldHalf - this.wallThickness / 2;
  private readonly groundHalfWidth = this.worldHalf - this.wallThickness / 2;
  private readonly wallHalfHeight = this.worldHalf - this.groundThickness;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly camera: Camera;
  private readonly input = new InputManager();
  private world: RAPIER.World | null = null;
  private tileRenderer: TileRenderer | null = null;
  private animator: SpriteAnimator | null = null;
  private bg: Frame | null = null;
  private player: Player | null = null;
  private bgOffsetX = 0;
  private readonly bgParallax = 0.2;
  private health = 100;
  private stamina = 100;
  private runTime = 0;
  private sprintLock = 0;
  private hudTime = 0;

  private last = performance.now();
  private accumulator = 0;
  private readonly fixedDt = 1 / 120;
  private readonly maxStepsPerFrame = 10;
  
  constructor() {
    const canvas = document.querySelector<HTMLCanvasElement>('#app');

    if (!canvas) throw new Error('Canvas element #app not found');

    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Canvas 2D context unavailable');

    this.canvas = canvas;
    this.ctx = ctx;
    this.camera = new Camera(this.canvas, this.ctx, this.worldSize);
  }

  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World(this.gravity);
    const params = this.world.integrationParameters;

    params.maxVelocityIterations = 16;
    params.maxPositionIterations = 8;

    const [bg, tile, idleFrames, runningFrames, walkingFrames]: [
      Frame,
      Frame,
      Frame[],
      Frame[],
      Frame[]
    ] = await Promise.all([
      loadImage(bgUrl),
      loadImage(tileUrl),
      loadFrames(idleImports),
      loadFrames(runningImports),
      loadFrames(walkingImports)
    ]);

    this.bg = bg;
    this.tileRenderer = new TileRenderer(this.ctx, this.camera, tile);
    this.animator = new SpriteAnimator(idleFrames, walkingFrames, runningFrames);
    this.createBounds();
    this.createPlayer();
    requestAnimationFrame(this.loop);
  }

  private createBounds() {
    if (!this.world) return;

    const staticBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.groundHalfWidth,
        this.groundThickness / 2
      )
        .setTranslation(0, this.groundY)
        .setFriction(1),
      staticBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.groundHalfWidth,
        this.wallThickness / 2
      )
        .setTranslation(0, this.ceilingY)
        .setFriction(1),
      staticBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.wallThickness / 2,
        this.wallHalfHeight
      )
        .setTranslation(this.leftX, this.groundThickness / 2)
        .setFriction(1),
      staticBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.wallThickness / 2,
        this.wallHalfHeight
      )
        .setTranslation(this.rightX, this.groundThickness / 2)
        .setFriction(1),
      staticBody
    );
  }

  private createPlayer() {
    if (!this.world) return;

    this.player = new Player(this.world, {
      x: 0,
      y: this.groundY + this.groundThickness / 2 + 1
    });
  }

  private stepPhysics(dt: number) {
    if (!this.world) return;

    this.accumulator += dt;
    const steps = Math.min(
      Math.floor(this.accumulator / this.fixedDt),
      this.maxStepsPerFrame
    );

    if (steps > 0) {
      this.world.integrationParameters.dt = this.fixedDt;
      for (let i = 0; i < steps; i += 1) {
        this.world.step();
      }

      this.accumulator -= steps * this.fixedDt;
    }
  }

  private applyControl(dt: number) {
    if (!this.player) return;

    const body = this.player.body;
    const vel = body.linvel();
    const pos = body.translation();
    const footY = pos.y - this.player.halfH;
    const groundTop = this.groundY + this.groundThickness / 2;
    const onGround = footY <= groundTop + 0.05 && Math.abs(vel.y) < 1;

    const hasDir = this.input.state.left || this.input.state.right;
    this.sprintLock = Math.max(0, this.sprintLock - dt);
    const wantsSprint = this.input.state.sprint && this.sprintLock <= 0 && this.stamina > 0;
    const running = hasDir && wantsSprint;

    if (running) {
      this.runTime += dt;
      const drainPerSec = 0.5 * Math.exp(0.5 * this.runTime); // exponential drain
      this.stamina = Math.max(0, this.stamina - drainPerSec * dt);
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.sprintLock = 5; // lock sprint for 5 seconds
        this.runTime = 0;
      }
    } else {
      this.runTime = 0;
      if (hasDir) {
        this.stamina = Math.min(100, this.stamina + 1 * dt);
      } else {
        this.stamina = Math.min(100, this.stamina + 5 * dt);
      }
    }

    this.isSprinting = running && this.stamina > 0 && this.sprintLock <= 0;
    let desiredVx = 0;
    const walkSpeed = 2.5;
    const runSpeed = 5;

    if (this.input.state.left) {
      desiredVx -= this.isSprinting ? runSpeed : walkSpeed;
    }

    if (this.input.state.right) {
      desiredVx += this.isSprinting ? runSpeed : walkSpeed;
    }

    const control = onGround ? 12 : 6;
    const newVx = vel.x + (desiredVx - vel.x) * control * dt;

    body.setLinvel({ x: newVx, y: vel.y }, true);

    // Snap to ground when grounded to avoid vertical drift from contact jitter
    if (onGround) {
      body.setTranslation(
        { x: pos.x, y: groundTop + this.player.halfH },
        true
      );
      body.setLinvel({ x: newVx, y: 0 }, true);
    } else {
      // Prevent sinking through the ground
      const correctedPos = body.translation();
      const correctedVel = body.linvel();
      const correctedFootY = correctedPos.y - this.player.halfH;
      const groundTopAfter = this.groundY + this.groundThickness / 2;

      if (correctedFootY < groundTopAfter) {
        body.setTranslation(
          {
            x: correctedPos.x,
            y: groundTopAfter + this.player.halfH
          },
          true
        );
        if (correctedVel.y < 0) {
          body.setLinvel({ x: correctedVel.x, y: 0 }, true);
        }
      }
    }
  }

  private render(dt: number) {
    if (!this.player || !this.animator) return;

    const body = this.player.body;
    const renderPos = body.translation();

    // Camera follow
    this.camera.follow(renderPos, this.worldHalf);

    // Background with parallax and oversized tiling
    if (this.bg) {
      const bgWidth = this.camera.viewWidth * 1.5; // oversize to avoid seams
      const bgHeight = this.camera.viewHeight * 1.5;
      const parallaxX = this.camera.pos.x * this.bgParallax;

      this.bgOffsetX = parallaxX % bgWidth;
      const startX = -bgWidth / 2 - this.bgOffsetX;
      const drawY = (this.camera.viewHeight - bgHeight) / 2;

      for (let i = -1; i <= 1; i += 1) {
        const drawX = startX + i * bgWidth + this.camera.viewWidth / 2;

        this.ctx.drawImage(this.bg, drawX, drawY, bgWidth, bgHeight);
      }
    } else {
      this.ctx.fillStyle = '#8ecdf5';
      this.ctx.fillRect(
        0,
        0,
        this.camera.viewWidth,
        this.camera.viewHeight
      );
    }

    // Ground tiles
    this.tileRenderer?.drawGround(this.groundY, this.worldHalf);

    // Player sprite
    const vel = body.linvel();
    const speed = Math.abs(vel.x);
    // reuse sprint flag from control logic
    const hasDir = this.input.state.left || this.input.state.right;
    const wantsSprint = this.input.state.sprint && this.sprintLock <= 0 && this.stamina > 0;
    const mode: 'idle' | 'walk' | 'run' =
      speed > 0.2 && hasDir
        ? wantsSprint && this.isSprinting
          ? 'run'
          : 'walk'
        : 'idle';
    const sprite = this.animator.update(dt, mode);
    const facing: Facing = this.input.state.facing;
    const { x: sx, y: sy } = this.camera.worldToScreen(
      renderPos.x,
      renderPos.y - this.player.halfH
    );

    if (sprite) {
      const spriteHeightPx = 2 * this.player.halfH * this.camera.metersToPixels;
      const padRatio = 170 / 900; // image padding top/bottom
      const srcY = sprite.height * padRatio;
      const srcH = sprite.height - srcY * 2;
      const srcW = sprite.width;
      const spriteWidthPx = spriteHeightPx * (srcW / srcH);

      this.ctx.save();
      this.ctx.translate(sx, sy);
      this.ctx.scale(facing, 1);
      this.ctx.drawImage(
        sprite,
        0,
        srcY,
        srcW,
        srcH,
        -spriteWidthPx / 2,
        -spriteHeightPx,
        spriteWidthPx,
        spriteHeightPx
      );
      this.ctx.restore();
    }

    this.drawHud();
  }

  private drawHud() {
    this.hudTime += 0.016; // approximate; HUD is visual only

    const barWidth = this.camera.viewWidth * 0.05;
    const barHeight = 8;
    const margin = 12;
    const gap = 6;
    const border = 1;
    const startX = margin;
    const startY = this.camera.viewHeight - margin - (barHeight + gap) * 2;

    const drawBar = (
      y: number,
      value: number,
      color: string,
      alpha = 1
    ) => {
      const clamped = Math.max(0, Math.min(100, value));
      const fillWidth = (barWidth - border * 2) * (clamped / 100);

      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(startX, y, barWidth, barHeight);

      this.ctx.fillStyle = color;
      if (alpha < 1) {
        this.ctx.globalAlpha = alpha;
      }
      this.ctx.fillRect(startX + border, y + border, fillWidth, barHeight - border * 2);
      this.ctx.globalAlpha = 1;
    };

    drawBar(startY, this.health, '#e23d55'); // health - red

    const lowStamina = this.stamina < 33;
    const blinkAlpha = lowStamina ? 0.4 + 0.4 * Math.abs(Math.sin(this.hudTime * 3)) : 1;
    drawBar(startY + barHeight + gap, this.stamina, '#e9edf7', blinkAlpha); // stamina - white
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.last) / 1000, 1 / 30);

    this.last = now;

    this.applyControl(dt);
    this.stepPhysics(dt);
    this.render(dt);

    requestAnimationFrame(this.loop);
  };
}

