import { Facing } from './types';

// Centralized input manager for keyboard state.
export class InputManager {
  state = {
    left: false,
    right: false,
    sprint: false,
    facing: 1 as Facing
  };

  constructor() {
    
    const keyMap: Record<string, keyof typeof this.state> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      a: 'left',
      A: 'left',
      d: 'right',
      D: 'right',
      Shift: 'sprint',
      ShiftLeft: 'sprint',
      ShiftRight: 'sprint'
    };

    window.addEventListener('keydown', (e) => {
      const mapped = keyMap[e.key];

      if (mapped) {
        this.state[mapped] = true;
        if (mapped === 'left') this.state.facing = -1;

        if (mapped === 'right') this.state.facing = 1;
      }
    });

    window.addEventListener('keyup', (e) => {
      const mapped = keyMap[e.key];

      if (mapped) {
        this.state[mapped] = false;
      }
    });

    window.addEventListener('blur', () => {
      this.state.left = false;
      this.state.right = false;
      this.state.sprint = false;
    });
  }
}

