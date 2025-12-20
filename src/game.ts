import RAPIER from '@dimforge/rapier2d-compat';

import bgUrl from '../assets/bg.png';
import tileUrl from '../assets/tile.png';

import { Camera } from './graphics/camera';
import { SpriteAnimator } from './graphics/spriteAnimator';
import { TileRenderer } from './graphics/tileRenderer';
import { InputManager } from './input';
import { Facing, Frame, Mode } from './types';
import { loadFrames, loadImage } from './utils/assets';
import { Player } from './world/player';

// Collision groups:
// player: membership 0x1, collides only with static (mask 0x2)
// static: membership 0x2, collides with player|bot (mask 0x1|0x4)
// bot:    membership 0x4, collides only with static (mask 0x2)
const GROUP_PLAYER = 0x0001;
const GROUP_STATIC = 0x0002;
const GROUP_BOT = 0x0004;
// Helper: upper 16 bits = membership, lower 16 bits = filter (alternative layout if previous mask failed)
const cg = (membership: number, filter: number) =>
  (membership << 16) | filter;

const idleImports = import.meta.glob('../assets/player/idle/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const deadImports = import.meta.glob('../assets/player/dead/*.png', {
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
const idleAttackImports = import.meta.glob('../assets/player/atack/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const moveAttackImports = import.meta.glob(
  '../assets/player/running-atack/*.png',
  {
    query: '?url',
    import: 'default',
    eager: true
  }
);
const botIdleImports = import.meta.glob('../assets/bots/1/idle/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const botDeadImports = import.meta.glob('../assets/bots/1/dead/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const botWalkImports = import.meta.glob('../assets/bots/1/walking/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const botRunImports = import.meta.glob('../assets/bots/1/running/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const botIdleAttackImports = import.meta.glob('../assets/bots/1/atack/*.png', {
  query: '?url',
  import: 'default',
  eager: true
});
const botMoveAttackImports = import.meta.glob(
  '../assets/bots/1/running-atack/*.png',
  {
    query: '?url',
    import: 'default',
    eager: true
  }
);

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
  private bots: Array<{
    actor: Player;
    animator: SpriteAnimator;
    health: number;
    attackMode: 'none' | 'idle' | 'move';
    attackTimer: number;
    attackCooldown: number;
    attackHitApplied: boolean;
    aggro: boolean;
    running: boolean;
    facing: Facing;
    timer: number;
    move: boolean;
  }> = [];
  private bgOffsetX = 0;
  private readonly bgParallax = 0.2;
  private health = 100;
  private stamina = 100;
  private runTime = 0;
  private sprintLock = 0;
  private hudTime = 0;
  private attackMode: 'none' | 'idle' | 'move' = 'none';
  private attackTimer = 0;
  private attackDurationIdle = 0.5;
  private attackDurationMove = 0.5;
  private lastAttackPressed = false;
  private playerAttackHitApplied = false;
  private floatTexts: {
    x: number;
    y: number;
    value: number;
    color: string;
    ttl: number;
    age: number;
  }[] = [];
  private botFrames:
    | {
        idle: Frame[];
        walk: Frame[];
        run: Frame[];
        idleAttack: Frame[];
        moveAttack: Frame[];
        dead: Frame[];
      }
    | null = null;

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

    const [
      bg,
      tile,
      idleFrames,
      deadFrames,
      runningFrames,
      walkingFrames,
      idleAttackFrames,
      moveAttackFrames,
      botIdleFrames,
      botDeadFrames,
      botWalkFrames,
      botRunFrames,
      botIdleAttackFrames,
      botMoveAttackFrames
    ]: [
      Frame,
      Frame,
      Frame[],
      Frame[],
      Frame[],
      Frame[],
      Frame[],
      Frame[],
      Frame[],
      Frame[],
      Frame[],
      Frame[],
      Frame[]
    ] = await Promise.all([
      loadImage(bgUrl),
      loadImage(tileUrl),
      loadFrames(idleImports),
      loadFrames(deadImports),
      loadFrames(runningImports),
      loadFrames(walkingImports),
      loadFrames(idleAttackImports),
      loadFrames(moveAttackImports),
      loadFrames(botIdleImports),
      loadFrames(botDeadImports),
      loadFrames(botWalkImports),
      loadFrames(botRunImports),
      loadFrames(botIdleAttackImports),
      loadFrames(botMoveAttackImports)
    ]);

    this.bg = bg;
    this.tileRenderer = new TileRenderer(this.ctx, this.camera, tile);
    this.animator = new SpriteAnimator(
      idleFrames,
      walkingFrames,
      runningFrames,
      idleAttackFrames,
      moveAttackFrames,
      deadFrames
    );
    this.botFrames = {
      idle: botIdleFrames,
      walk: botWalkFrames,
      run: botRunFrames,
      idleAttack: botIdleAttackFrames,
      moveAttack: botMoveAttackFrames,
      dead: botDeadFrames
    };
    this.attackDurationIdle =
      idleAttackFrames.length > 0
        ? idleAttackFrames.length * (1 / 60)
        : 0.5;
    this.attackDurationMove =
      moveAttackFrames.length > 0
        ? moveAttackFrames.length * (1 / 60)
        : 0.5;
    this.createBounds();
    this.createPlayer();
    this.spawnBots();
    requestAnimationFrame(this.loop);
  }

  private createBounds() {
    if (!this.world) return;

    const staticBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

    // Collision groups: static=0x1, player=0x2, bot=0x4
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.groundHalfWidth,
        this.groundThickness / 2
      )
        .setTranslation(0, this.groundY)
        .setFriction(1)
        .setCollisionGroups(cg(GROUP_STATIC, GROUP_PLAYER | GROUP_BOT)),
      staticBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.groundHalfWidth,
        this.wallThickness / 2
      )
        .setTranslation(0, this.ceilingY)
        .setFriction(1)
        .setCollisionGroups(cg(GROUP_STATIC, GROUP_PLAYER | GROUP_BOT)),
      staticBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.wallThickness / 2,
        this.wallHalfHeight
      )
        .setTranslation(this.leftX, this.groundThickness / 2)
        .setFriction(1)
        .setCollisionGroups(cg(GROUP_STATIC, GROUP_PLAYER | GROUP_BOT)),
      staticBody
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.wallThickness / 2,
        this.wallHalfHeight
      )
        .setTranslation(this.rightX, this.groundThickness / 2)
        .setFriction(1)
        .setCollisionGroups(cg(GROUP_STATIC, GROUP_PLAYER | GROUP_BOT)),
      staticBody
    );
  }

  private createPlayer() {
    if (!this.world) return;

    this.player = new Player(this.world, {
      x: 0,
      y: this.groundY + this.groundThickness / 2 + 1
    });
    this.player.collider.setCollisionGroups(cg(GROUP_PLAYER, GROUP_STATIC));
    this.player.collider.setActiveCollisionTypes(
      RAPIER.ActiveCollisionTypes.DEFAULT &
        ~RAPIER.ActiveCollisionTypes.DYNAMIC_DYNAMIC
    );
    this.health = 100;
    this.stamina = 100;
    this.attackMode = 'none';
    this.attackTimer = 0;
    this.playerAttackHitApplied = false;
    this.input.setEnabled(true);
  }

  private spawnBots() {
    if (!this.world || !this.botFrames) return;
    this.bots = [];
    const count = 5 + Math.floor(Math.random() * 6); // 5-10 bots
    for (let i = 0; i < count; i += 1) {
      const x = (Math.random() * 0.8 - 0.4) * this.worldSize;
      const actor = new Player(this.world, {
        x,
        y: this.groundY + this.groundThickness / 2 + 1
      });
      actor.collider.setCollisionGroups(cg(GROUP_BOT, GROUP_STATIC));
      actor.collider.setActiveCollisionTypes(
        RAPIER.ActiveCollisionTypes.DEFAULT &
          ~RAPIER.ActiveCollisionTypes.DYNAMIC_DYNAMIC
      );
      const animator = new SpriteAnimator(
        this.botFrames.idle,
        this.botFrames.walk,
        this.botFrames.run,
        this.botFrames.idleAttack,
        this.botFrames.moveAttack,
        this.botFrames.dead
      );
      this.bots.push({
        actor,
        animator,
        health: 100,
        attackMode: 'none',
        attackTimer: 0,
        attackCooldown: 0,
        attackHitApplied: false,
        aggro: false,
        running: false,
        facing: 1,
        timer: 0,
        move: false
      });
    }
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
    if (!this.player || this.health <= 0) return;

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

    // Attacks: edge-triggered on space
    const attackPressed = this.input.state.attack;

    if (attackPressed && !this.lastAttackPressed && this.attackMode === 'none') {
      const movingAttack = hasDir;
      const cost = movingAttack ? 5 : 2;

      if (this.stamina >= cost) {
        this.stamina = Math.max(0, this.stamina - cost);
        this.attackMode = movingAttack ? 'move' : 'idle';
        this.attackTimer = movingAttack
          ? this.attackDurationMove
          : this.attackDurationIdle;
        this.playerAttackHitApplied = false;
      }
    }

    this.lastAttackPressed = attackPressed;

    if (this.attackMode !== 'none') {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackMode = 'none';
        this.attackTimer = 0;
        this.playerAttackHitApplied = false;
      }
    }

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

  private handleCombat() {
    if (!this.player) return;

    const playerAlive = this.health > 0;
    const anyBotAlive = this.bots.some((b) => b.health > 0);

    if (!playerAlive && !anyBotAlive) return;

    // Player attacking bots (single hit per swing)
    if (this.attackMode !== 'none' && !this.playerAttackHitApplied) {
      for (const bot of this.bots) {
        if (bot.health <= 0) continue;
        const dx =
          bot.actor.body.translation().x - this.player.body.translation().x;
        const overlapX = Math.abs(dx) <= this.player.halfW + bot.actor.halfH;
        const playerFacingTarget = Math.sign(dx || 1) === this.input.state.facing;
        if (overlapX && playerFacingTarget) {
          const dmg = this.randomDamage();
          bot.health = Math.max(0, bot.health - dmg);
          bot.aggro = true;
          this.playerAttackHitApplied = true;
          const botPos = bot.actor.body.translation();
          this.addFloatText(
            botPos.x,
            botPos.y + bot.actor.halfH + 0.3,
            dmg,
            '#f5f5f5'
          );
          if (bot.health <= 0) {
            bot.attackMode = 'none';
            bot.attackTimer = 0;
            bot.attackHitApplied = false;
          }
          break;
        }
      }
    }

    // Bots attacking player
    if (playerAlive) {
      for (const bot of this.bots) {
        if (
          bot.health > 0 &&
          bot.aggro &&
          bot.attackMode !== 'none' &&
          !bot.attackHitApplied
        ) {
          const dx =
            bot.actor.body.translation().x - this.player.body.translation().x;
          const overlapX = Math.abs(dx) <= this.player.halfW + bot.actor.halfH;
          const botFacingTarget = Math.sign(-dx || 1) === bot.facing;
          if (overlapX && botFacingTarget) {
            const dmg = this.randomDamage();
            this.health = Math.max(0, this.health - dmg);
            bot.attackHitApplied = true;
            const pPos = this.player.body.translation();
            this.addFloatText(
              pPos.x,
              pPos.y + this.player.halfH + 0.3,
              dmg,
              '#e23d55'
            );
            if (this.health <= 0) {
              this.attackMode = 'none';
              this.attackTimer = 0;
              this.playerAttackHitApplied = false;
              this.input.setEnabled(false);
            }
          }
        }
      }
    }
  }

  private randomDamage() {
    return Math.floor(5 + Math.random() * 6); // 5..10
  }

  private addFloatText(x: number, y: number, value: number, color: string) {
    this.floatTexts.push({
      x,
      y,
      value,
      color,
      ttl: 1,
      age: 0
    });
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

    // Bots render
    for (const bot of this.bots) {
      const botBody = bot.actor.body;
      const botPos = botBody.translation();
      const botVel = botBody.linvel();

      if (botVel.x > 0.1) bot.facing = 1;
      if (botVel.x < -0.1) bot.facing = -1;

      let botMode: Mode = bot.move ? 'walk' : 'idle';
      if (bot.health <= 0) {
        botMode = 'dead';
      } else {
        if (bot.attackMode === 'idle') botMode = 'idle-attack';
        if (bot.attackMode === 'move') botMode = 'move-attack';
        if (bot.running && bot.attackMode === 'none') botMode = 'run';
      }

      const botSprite = bot.animator.update(dt, botMode);
      const { x: bx, y: by } = this.camera.worldToScreen(
        botPos.x,
        botPos.y - bot.actor.halfH
      );

      if (botSprite) {
        const spriteHeightPx = 2 * bot.actor.halfH * this.camera.metersToPixels;
        const padRatio = 170 / 900;
        const srcY = botSprite.height * padRatio;
        const srcH = botSprite.height - srcY * 2;
        const srcW = botSprite.width;
        const spriteWidthPx = spriteHeightPx * (srcW / srcH);

        this.ctx.save();
        this.ctx.translate(bx, by);
        this.ctx.scale(bot.facing, 1);
        this.ctx.drawImage(
          botSprite,
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

    // Player sprite
    const vel = body.linvel();
    const speed = Math.abs(vel.x);
    const hasDir = this.input.state.left || this.input.state.right;
    const wantsSprint = this.input.state.sprint && this.sprintLock <= 0 && this.stamina > 0;
    const isMoving = speed > 0.2 && hasDir;
    let mode: Mode = 'idle';

    if (this.health <= 0) {
      mode = 'dead';
    } else if (this.attackMode === 'idle') {
      mode = 'idle-attack';
    } else if (this.attackMode === 'move') {
      mode = 'move-attack';
    } else if (isMoving) {
      mode = wantsSprint && this.isSprinting ? 'run' : 'walk';
    }

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

    this.drawFloatTexts(dt);
    this.drawHud();
  }

  private drawFloatTexts(dt: number) {
    if (!this.player) return;

    this.floatTexts = this.floatTexts.filter((f) => f.age < f.ttl);
    for (const f of this.floatTexts) {
      f.age += dt;
      const alpha = Math.max(0, 1 - f.age / f.ttl);
      const rise = f.age * 1; // meters per second upward
      const { x, y } = this.camera.worldToScreen(f.x, f.y + rise);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = f.color;
      this.ctx.font = '16px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${f.value}`, x, y);
      this.ctx.restore();
    }
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
      x: number,
      y: number,
      value: number,
      color: string,
      alpha = 1
    ) => {
      const clamped = Math.max(0, Math.min(100, value));
      const fillWidth = (barWidth - border * 2) * (clamped / 100);

      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(x, y, barWidth, barHeight);

      this.ctx.fillStyle = color;
      if (alpha < 1) {
        this.ctx.globalAlpha = alpha;
      }

      this.ctx.fillRect(x + border, y + border, fillWidth, barHeight - border * 2);
      this.ctx.globalAlpha = 1;
    };

    drawBar(startX, startY, this.health, '#e23d55'); // player health

    const lowStamina = this.stamina < 33;
    const blinkAlpha = lowStamina ? 0.4 + 0.4 * Math.abs(Math.sin(this.hudTime * 3)) : 1;

    drawBar(startX, startY + barHeight + gap, this.stamina, '#e9edf7', blinkAlpha); // stamina - white
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.last) / 1000, 1 / 30);

    this.last = now;

    this.applyControl(dt);
    this.stepPhysics(dt);
    this.updateBots(dt);
    this.handleCombat();
    this.render(dt);

    requestAnimationFrame(this.loop);
  };

  private updateBots(dt: number) {
    if (!this.world) return;
    const playerAlive = this.player && this.health > 0;

    for (const bot of this.bots) {
      const body = bot.actor.body;
      if (bot.health <= 0) {
        body.setLinvel({ x: 0, y: 0 }, true);
        continue;
      }

      const vel = body.linvel();
      const pos = body.translation();
      const footY = pos.y - bot.actor.halfH;
      const groundTop = this.groundY + this.groundThickness / 2;
      const onGround = footY <= groundTop + 0.05 && Math.abs(vel.y) < 1;

      // Attack timer
      if (bot.attackMode !== 'none') {
        bot.attackTimer -= dt;
        if (bot.attackTimer <= 0) {
          bot.attackMode = 'none';
          bot.attackTimer = 0;
          bot.attackHitApplied = false;
          bot.attackCooldown = 0.5;
        }
      }
      bot.attackCooldown = Math.max(0, bot.attackCooldown - dt);

      const walkSpeed = 2.2;
      const runSpeed = 4.2;

      let desiredVx = 0;
      let chaseTarget = false;
      bot.running = false;

      if (bot.aggro && playerAlive && this.player) {
        bot.move = false;
        const targetX = this.player.body.translation().x;
        const dx = targetX - pos.x;
        const reach = this.player.halfW + bot.actor.halfW;
        const inRange = Math.abs(dx) <= reach;
        bot.facing = dx >= 0 ? 1 : -1;
        desiredVx = inRange ? 0 : runSpeed * bot.facing;
        chaseTarget = true;
        bot.running = !inRange;

        if (inRange) {
          if (bot.attackMode === 'none' && bot.attackCooldown <= 0) {
            const movingAttack = Math.abs(vel.x) > 0.2;
            bot.attackMode = movingAttack ? 'move' : 'idle';
            bot.attackTimer = movingAttack
              ? this.attackDurationMove
              : this.attackDurationIdle;
            bot.attackHitApplied = false;
          }
        }
      }

      if (!bot.aggro) {
        bot.timer -= dt;
        if (bot.timer <= 0) {
          bot.move = Math.random() > 0.4; // 60% move, 40% idle
          bot.timer = 1 + Math.random() * 2; // 1-3 seconds
          if (bot.move) {
            bot.facing = Math.random() > 0.5 ? 1 : -1;
          }
        }
        desiredVx = bot.move ? walkSpeed * bot.facing : 0;
      }

      let finalDesiredVx = desiredVx;
      const nearRight = pos.x > this.rightX - 0.5;
      const nearLeft = pos.x < this.leftX + 0.5;

      if (nearRight) {
        bot.facing = -1;
        finalDesiredVx = Math.min(finalDesiredVx, 0);
      }

      if (nearLeft) {
        bot.facing = 1;
        finalDesiredVx = Math.max(finalDesiredVx, 0);
      }

      const control = onGround ? 10 : 4;
      const newVx = vel.x + (finalDesiredVx - vel.x) * control * dt;

      body.setLinvel({ x: newVx, y: vel.y }, true);

      if (onGround) {
        body.setTranslation(
          { x: pos.x, y: groundTop + bot.actor.halfH },
          true
        );
        if (vel.y !== 0) {
          body.setLinvel({ x: newVx, y: 0 }, true);
        }
      }

      if (!playerAlive && bot.aggro && !chaseTarget) {
        bot.aggro = false;
        bot.attackMode = 'none';
        bot.attackTimer = 0;
        bot.attackHitApplied = false;
        bot.running = false;
      }
    }
  }
}

