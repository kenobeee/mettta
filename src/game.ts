import RAPIER from '@dimforge/rapier2d-compat';
import bgUrl from '../assets/bg.png';
import tileUrl from '../assets/tile.png';
import { Facing, Frame, Vec2 } from './types';
import { InputManager } from './input';
import { Camera } from './graphics/camera';
import { TileRenderer } from './graphics/tileRenderer';
import { SpriteAnimator } from './graphics/spriteAnimator';
import { Player } from './world/player';
import { loadFrames, loadImage } from './utils/assets';

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
    this.world.integrationParameters.maxVelocityIterations = 16;
    this.world.integrationParameters.maxPositionIterations = 8;

    const [bg, tile, idleFrames, runningFrames, walkingFrames] =
      await Promise.all([
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


    let desiredVx = 0;
    const walkSpeed = 2.5;
    const runSpeed = 5;
    if (this.input.state.left) desiredVx -= walkSpeed;
    if (this.input.state.right) desiredVx += walkSpeed;
    if (this.input.state.sprint) {
      desiredVx =
        desiredVx > 0 ? runSpeed : desiredVx < 0 ? -runSpeed : 0;
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
    const mode: 'idle' | 'walk' | 'run' =
      speed > 0.2
        ? this.input.state.sprint
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

