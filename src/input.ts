import { Facing } from './types';

// Centralized input manager for keyboard state.
export class InputManager {
  state = {
    left: false,
    right: false,
    sprint: false,
    attack: false,
    facing: 1 as Facing
  };
  private disabled = false;

  setEnabled(enabled: boolean) {
    this.disabled = !enabled;
    if (this.disabled) {
      this.state.left = false;
      this.state.right = false;
      this.state.sprint = false;
      this.state.attack = false;
    }
  }

  constructor() {
    
    const keyMap: Record<string, keyof typeof this.state> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      a: 'left',
      A: 'left',
      d: 'right',
      D: 'right',
      ' ': 'attack',
      Space: 'attack',
      Shift: 'sprint',
      ShiftLeft: 'sprint',
      ShiftRight: 'sprint'
    };

    window.addEventListener('keydown', (e) => {
      if (this.disabled) return;
      const mapped = keyMap[e.key];

      if (mapped) {
        this.state[mapped] = true;
        if (mapped === 'left') this.state.facing = -1;

        if (mapped === 'right') this.state.facing = 1;
        if (mapped === 'attack') e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.disabled) return;
      const mapped = keyMap[e.key];

      if (mapped) {
        this.state[mapped] = false;
        if (mapped === 'attack') e.preventDefault();
      }
    });

    window.addEventListener('blur', () => {
      this.state.left = false;
      this.state.right = false;
      this.state.sprint = false;
      this.state.attack = false;
    });
  }
}

