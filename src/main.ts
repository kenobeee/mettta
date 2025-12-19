import './style.css';
import { Game } from './game';

const game = new Game();

game.init().catch((err) => {
  console.error('Failed to init Rapier', err);
  const errorBanner = document.createElement('div');

  errorBanner.textContent = 'Ошибка инициализации Rapier. См. консоль.';
  errorBanner.className = 'error';
  document.body.append(errorBanner);
});

