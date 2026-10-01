import * as THREE from 'three';
import { SILOS, BRAND } from '../hero.constants';
import type { Silo } from '../hero.constants';

const W = 512;
const H = 320;

/** One baked glass panel, with the context kept so it can be repainted. */
export interface SiloPanel {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  /** False once the system has "gone dark" and the panel has been blanked. */
  alive: boolean;
}

/**
 * One glass panel per disconnected system. Each is baked once into its own
 * texture; the pulsing, glitching and dissolving all happen in the material
 * and animation layers, so nothing here runs per-frame.
 */
export function createSiloTextures(): SiloPanel[] {
  return SILOS.map((silo) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`createSiloTextures: 2D context unavailable for ${silo.id}`);
    paintSilo(ctx, silo);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, ctx, texture, alive: true };
  });
}

/** Blanks a panel once its system has gone dark. */
export function killSilo(panel: SiloPanel | null | undefined): void {
  if (!panel?.alive) return;
  panel.alive = false;

  const c = panel.ctx;
  c.clearRect(0, 0, W, H);
  c.strokeStyle = 'rgba(124, 147, 180, 0.14)';
  c.lineWidth = 2;
  c.strokeRect(14, 14, W - 28, H - 28);
  panel.texture.needsUpdate = true;
}

export function reviveSilos(panels: SiloPanel[] | null | undefined): void {
  if (!panels) return;
  panels.forEach((panel, i) => {
    if (!panel || panel.alive) return;
    paintSilo(panel.ctx, SILOS[i]);
    panel.texture.needsUpdate = true;
    panel.alive = true;
  });
}

function paintSilo(c: CanvasRenderingContext2D, silo: Silo): void {
  c.clearRect(0, 0, W, H);

  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(28, 44, 70, 0.72)');
  g.addColorStop(1, 'rgba(15, 26, 44, 0.55)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  c.strokeStyle = 'rgba(150, 180, 225, 0.35)';
  c.lineWidth = 2;
  c.strokeRect(10, 10, W - 20, H - 20);

  c.fillStyle = 'rgba(124, 147, 180, 0.16)';
  c.fillRect(10, 10, W - 20, 54);
  c.fillStyle = 'rgba(200, 220, 250, 0.9)';
  c.font = '700 30px Manrope, sans-serif';
  c.fillText(silo.label, 32, 48);

  c.fillStyle = 'rgba(150, 175, 210, 0.6)';
  c.font = '500 19px DM Sans, sans-serif';
  c.fillText(silo.sub, 32, 92);

  // Amber "stale" indicator — this system is running, just not talking to anything.
  c.beginPath();
  c.arc(W - 42, 38, 8, 0, Math.PI * 2);
  c.fillStyle = BRAND.amber;
  c.fill();

  for (let i = 0; i < 4; i++) {
    const y = 130 + i * 42;
    c.fillStyle = 'rgba(255,255,255,0.055)';
    c.fillRect(32, y, W - 64, 28);
    c.fillStyle = 'rgba(160, 185, 220, 0.35)';
    c.fillRect(44, y + 9, 90 + ((i * 53) % 120), 10);
    c.fillStyle = 'rgba(150, 175, 210, 0.22)';
    c.fillRect(W - 150, y + 9, 100, 10);
  }

  // Static grain — the visual "these are not talking to each other" texture.
  c.save();
  c.globalAlpha = 0.055;
  for (let i = 0; i < 170; i++) {
    c.fillStyle = Math.random() > 0.5 ? '#9fc0f0' : '#5d7ba8';
    c.fillRect(Math.random() * W, Math.random() * H, Math.random() * 90, 1.5);
  }
  c.restore();

  c.fillStyle = 'rgba(96, 165, 250, 0.5)';
  c.fillRect(10, H - 14, (W - 20) * 0.18, 4);
}

/** Side livery for the delivery truck: LogiCraft wordmark across the box body. */
export function createLiveryTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('createLiveryTexture: 2D canvas context unavailable');

  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#f4f7fb');
  g.addColorStop(0.55, '#e8eef6');
  g.addColorStop(1, '#d4dde9');
  c.fillStyle = g;
  c.fillRect(0, 0, 1024, 512);

  c.save();
  c.translate(150, 176);
  c.rotate(-0.07);
  c.fillStyle = BRAND.blueDeep;
  c.beginPath();
  c.moveTo(8, 0); c.lineTo(104, 0); c.quadraticCurveTo(116, 0, 116, 12);
  c.lineTo(116, 100); c.quadraticCurveTo(116, 112, 104, 112);
  c.lineTo(8, 112); c.quadraticCurveTo(-4, 112, -4, 100);
  c.lineTo(-4, 12); c.quadraticCurveTo(-4, 0, 8, 0);
  c.closePath();
  c.fill();
  c.fillStyle = '#fff';
  c.fillRect(20, 62, 20, 30);
  c.fillRect(48, 36, 20, 56);
  c.fillRect(76, 48, 20, 44);
  c.restore();

  c.fillStyle = '#0f1c30';
  c.font = '800 92px Manrope, sans-serif';
  c.fillText('LogiCraft', 300, 258);

  c.fillStyle = '#5b6b82';
  c.font = '600 34px DM Sans, sans-serif';
  c.fillText('REAL-TIME LOGISTICS OS', 304, 312);

  c.strokeStyle = 'rgba(59, 130, 246, 0.55)';
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(152, 372);
  c.lineTo(872, 372);
  c.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
