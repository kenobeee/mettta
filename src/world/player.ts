import RAPIER from '@dimforge/rapier2d-compat';
import { Vec2 } from '../types';

// Player rigid body + collider setup.
export class Player {
  readonly halfW = 1; // 2m width
  readonly halfH = 1; // 2m height
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;

  constructor(world: RAPIER.World, startPos: Vec2) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(startPos.x, startPos.y)
        .setLinearDamping(1.2)
        .setAngularDamping(2)
        .setCcdEnabled(true)
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(this.halfW, this.halfH)
        .setFriction(0.9)
        .setRestitution(0)
        .setDensity(17.5),
      this.body
    );
  }
}

