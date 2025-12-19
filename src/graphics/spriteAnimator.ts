import { Frame } from '../types';

// Simple frame-step animator with multiple states.
export class SpriteAnimator {
  private timer = 0;
  private frame = 0;
  private readonly frameTime = 1 / 60; // 60 fps
  private currentMode: 'idle' | 'walk' | 'run' | 'idle-attack' | 'move-attack' = 'idle';

  constructor(
    private readonly idle: Frame[],
    private readonly walk: Frame[],
    private readonly run: Frame[],
    private readonly idleAttack: Frame[],
    private readonly moveAttack: Frame[]
  ) {}

  update(dt: number, mode: 'idle' | 'walk' | 'run' | 'idle-attack' | 'move-attack') {
    if (mode !== this.currentMode) {
      this.currentMode = mode;
      this.frame = 0;
      this.timer = 0;
    }

    const set =
      mode === 'run'
        ? this.run.length
          ? this.run
          : this.idle
        : mode === 'walk'
          ? this.walk.length
            ? this.walk
            : this.idle
          : mode === 'idle-attack'
            ? this.idleAttack.length
              ? this.idleAttack
              : this.idle
            : mode === 'move-attack'
              ? this.moveAttack.length
                ? this.moveAttack
                : this.walk
              : this.idle;

    this.timer += dt;
    if (this.timer > this.frameTime) {
      this.timer = 0;
      this.frame = (this.frame + 1) % set.length;
    }
    
    return set[this.frame % set.length];
  }
}

