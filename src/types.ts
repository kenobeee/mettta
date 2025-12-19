// Shared lightweight types to avoid circular deps.
export type Vec2 = { x: number; y: number };
export type Frame = HTMLImageElement;
export type Mode =
  | 'idle'
  | 'walk'
  | 'run'
  | 'idle-attack'
  | 'move-attack';
export type Facing = 1 | -1;

