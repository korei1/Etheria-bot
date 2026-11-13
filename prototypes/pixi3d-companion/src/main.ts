import './style.css';

import { Application, Assets } from 'pixi.js';
import { DirectionalLight, Model3D, View3D } from '@pixi/3d';
import type { Scene3DSource } from '@pixi/3d';
import { OrbitCamera } from '@pixi/3d/extras';

const FOX_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/Fox/glTF-Binary/Fox.glb';

const host = document.querySelector<HTMLDivElement>('#canvas-host');
const status = document.querySelector<HTMLParagraphElement>('#status');
const animationButtons = document.querySelectorAll<HTMLButtonElement>('[data-clip]');

if (!host || !status) {
  throw new Error('Éléments HTML du prototype introuvables.');
}

const setStatus = (message: string, state: 'loading' | 'ready' | 'error' = 'loading') => {
  status.textContent = message;
  status.dataset.state = state;
};

async function startCompanionPreview(): Promise<void> {
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
    environment: {
      skyColor: 0xc5e3f2,
      groundColor: 0x617b62,
    },
  });

  app.stage.addChild(view);

  const sun = new DirectionalLight({ intensity: 3 });
  sun.position.set(-3, 5, 4);
  view.root.addChild(sun);

  view.camera.position.set(0, 1.2, 3.8);
  new OrbitCamera({ view });

  setStatus('Chargement du modèle 3D…');

  const source = await Assets.load<Scene3DSource>(FOX_MODEL_URL);
  const fox = new Model3D({ source });

  if (fox.height > 0) {
    fox.scale.set(0.9 / fox.height);
  }

  view.root.addChild(fox);

  const playClip = (clipName: string) => {
    if (!fox.player) {
      setStatus('Le modèle ne contient pas de lecteur d’animation.', 'error');
      return;
    }

    fox.player.play(clipName);
    animationButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.clip === clipName);
    });
    setStatus(`Animation : ${clipName}`, 'ready');
  };

  animationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const clipName = button.dataset.clip;
      if (clipName) playClip(clipName);
    });
  });

  playClip('Survey');
  setStatus('Compagnon chargé · fais glisser pour tourner autour de lui.', 'ready');
}

startCompanionPreview().catch((error: unknown) => {
  console.error(error);
  setStatus(
    'Impossible de charger la scène 3D. Vérifie la connexion et la compatibilité WebGL2/WebGPU du navigateur.',
    'error',
  );
});
