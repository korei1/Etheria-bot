import './style.css';

import { Application, Assets } from 'pixi.js';
import { DirectionalLight, Model3D, View3D } from '@pixi/3d';
import type { Scene3DSource } from '@pixi/3d';
import { OrbitCamera } from '@pixi/3d/extras';

const LYKOS_MODEL_URL = '/assets/lykos.glb';

const host = document.querySelector<HTMLDivElement>('#canvas-host');
const status = document.querySelector<HTMLParagraphElement>('#status');
const animationButtons = document.querySelectorAll<HTMLButtonElement>('[data-clip]');

if (!host || !status) throw new Error('Éléments HTML introuvables.');

function setStatus(message: string, state: 'loading' | 'ready' | 'error' = 'loading') {
  status.textContent = message;
  status.dataset.state = state;
}

async function start(): Promise<void> {
  const app = new Application();
  await app.init({
    preference: 'webgpu',
    antialias: true,
    background: '#b8d4d9',
    resizeTo: host,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  const view = new View3D({
    autoResize: true,
    environment: { skyColor: 0xc5e3f2, groundColor: 0x617b62, intensity: 0.8 },
  });
  app.stage.addChild(view);

  const sun = new DirectionalLight({ intensity: 3, color: 0xfff1dc });
  sun.position.set(-3, 5, 4);
  sun.lookAt({ x: 0, y: 0.7, z: 0 });
  view.root.addChild(sun);

  view.camera.position.set(0, 1.25, 3.8);
  new OrbitCamera({
    view,
    target: { x: 0, y: 0.85, z: 0 },
    enableDamping: true,
    minDistance: 2,
    maxDistance: 8,
  });

  setStatus('Chargement de Lykos…');
  const source = await Assets.load<Scene3DSource>(LYKOS_MODEL_URL);
  const lykos = new Model3D({ source });
  if (lykos.height > 0) lykos.scale.set(1.25 / lykos.height);
  view.root.addChild(lykos);

  const playClip = (clipName: string) => {
    if (!lykos.player) {
      setStatus('Le modèle ne contient pas de lecteur d’animation.', 'error');
      return;
    }
    lykos.player.play(clipName);
    animationButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.clip === clipName);
    });
    setStatus('Lykos · animation ' + clipName, 'ready');
  };

  animationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.clip) playClip(button.dataset.clip);
    });
  });

  playClip('Idle');
  setStatus('Lykos est prêt · fais glisser pour tourner autour de lui.', 'ready');
}

start().catch((error: unknown) => {
  console.error(error);
  setStatus('Impossible de charger Lykos. Génère le fichier GLB avec Blender puis recharge la page.', 'error');
});
