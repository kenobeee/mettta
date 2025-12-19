import { Frame } from '../types';

import { Camera } from './camera';

// Draws tiled ground visuals (physics ground is a single collider).
export class TileRenderer {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly camera: Camera,
    private readonly tile: Frame | null
  ) {}

  drawGround(groundY: number, worldHalf: number, tileWorldSize = 1) {
    if (!this.tile) return;

    const tileWorldW = tileWorldSize;
    const tileWorldH = tileWorldSize;
    const startX = -worldHalf;
    const endX = worldHalf;

    // draw two rows to hide any gap
    for (let row = 0; row < 2; row += 1) {
      const y = groundY - row * tileWorldH;

      for (let x = startX; x < endX; x += tileWorldW) {
        const { x: sx, y: sy } = this.camera.worldToScreen(
          x + tileWorldW / 2,
          y
        );

        this.ctx.drawImage(
          this.tile,
          sx - (tileWorldW * this.camera.metersToPixels) / 2,
          sy - (tileWorldH * this.camera.metersToPixels) / 2,
          tileWorldW * this.camera.metersToPixels,
          tileWorldH * this.camera.metersToPixels
        );
      }
    }
  }
}

