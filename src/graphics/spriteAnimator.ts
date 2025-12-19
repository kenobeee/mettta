import { Frame } from '../types';

// Simple frame-step animator with three states.
export class SpriteAnimator {
  private timer = 0;
  private frame = 0;
  private readonly frameTime = 1 / 60; // 60 fps
  private currentMode: 'idle' | 'walk' | 'run' = 'idle';

  constructor(
    private readonly idle: Frame[],
    private readonly walk: Frame[],
    private readonly run: Frame[]
  ) {}

  update(dt: number, mode: 'idle' | 'walk' | 'run') {
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
          : this.idle;

    this.timer += dt;
    if (this.timer > this.frameTime) {
      this.timer = 0;
      this.frame = (this.frame + 1) % set.length;
    }
    
    return set[this.frame % set.length];
  }
}

