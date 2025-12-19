import { Vec2 } from '../types';

// Handles viewport sizing and world->screen transforms.
export class Camera {
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  metersToPixels = 1;
  readonly dpr = window.devicePixelRatio || 1;
  readonly viewMargin = 3.2; // larger -> closer zoom
  pos: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ctx: CanvasRenderingContext2D,
    private readonly worldSize: number
  ) {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.viewWidth = window.innerWidth;
    this.viewHeight = window.innerHeight;
    this.canvas.style.width = `${this.viewWidth}px`;
    this.canvas.style.height = `${this.viewHeight}px`;
    this.canvas.width = Math.round(this.viewWidth * this.dpr);
    this.canvas.height = Math.round(this.viewHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.metersToPixels =
      (Math.min(this.viewWidth, this.viewHeight) * this.viewMargin) /
      this.worldSize;
  }

  worldToScreen(x: number, y: number) {
    return {
      x: this.viewWidth / 2 + (x - this.pos.x) * this.metersToPixels,
      y: this.viewHeight / 2 - (y - this.pos.y) * this.metersToPixels
    };
  }

  follow(target: Vec2, worldHalf: number) {
    const viewHalfWorldX = this.viewWidth / (2 * this.metersToPixels);
    const viewHalfWorldY = this.viewHeight / (2 * this.metersToPixels);
    const desiredX = Math.max(
      -worldHalf + viewHalfWorldX,
      Math.min(target.x, worldHalf - viewHalfWorldX)
    );
    const desiredY = Math.max(
      -worldHalf + viewHalfWorldY,
      Math.min(target.y, worldHalf - viewHalfWorldY)
    );
    const smooth = 0.12;

    this.pos.x += (desiredX - this.pos.x) * smooth;
    this.pos.y += (desiredY - this.pos.y) * smooth;
  }
}

