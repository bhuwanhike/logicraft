import * as THREE from 'three';

/** Tiling asphalt with lane markings — one texture, repeated along the road. */
export function createRoadTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('world texture: 2D canvas context unavailable');

  c.fillStyle = '#151b26';
  c.fillRect(0, 0, size, size);

  // Aggregate
  for (let i = 0; i < 9000; i++) {
    const v = 18 + Math.random() * 34;
    c.fillStyle = `rgba(${v}, ${v + 4}, ${v + 12}, ${0.1 + Math.random() * 0.35})`;
    c.fillRect(Math.random() * size, Math.random() * size, 1.6, 1.6);
  }

  // Faint tyre polish down the two running lanes
  const lanes = [size * 0.3, size * 0.7];
  lanes.forEach((y) => {
    const g = c.createLinearGradient(0, y - 40, 0, y + 40);
    g.addColorStop(0, 'rgba(120, 150, 200, 0)');
    g.addColorStop(0.5, 'rgba(120, 150, 200, 0.05)');
    g.addColorStop(1, 'rgba(120, 150, 200, 0)');
    c.fillStyle = g;
    c.fillRect(0, y - 40, size, 80);
  });

  // Edge lines
  c.fillStyle = 'rgba(226, 234, 245, 0.5)';
  c.fillRect(0, size * 0.09, size, 5);
  c.fillRect(0, size * 0.885, size, 5);

  // Dashed centre line
  c.fillStyle = 'rgba(240, 198, 96, 0.62)';
  const dash = size * 0.34;
  const gap = size * 0.3;
  for (let y = 0; y < size; y += dash + gap) c.fillRect(0, y, size, dash);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 1.6);
  texture.anisotropy = 8;
  return texture;
}

/** Window grid for the background city — emissive, so the skyline reads at night. */
export function createWindowsTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('world texture: 2D canvas context unavailable');

  c.fillStyle = '#0a1020';
  c.fillRect(0, 0, w, h);

  const cols = 8;
  const rows = 22;
  const pad = 5;
  const cw = (w - pad * (cols + 1)) / cols;
  const ch = (h - pad * (rows + 1)) / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = Math.random();
      if (lit < 0.42) continue;
      const warm = Math.random() > 0.65;
      const a = 0.25 + Math.random() * 0.6;
      c.fillStyle = warm ? `rgba(255, 206, 140, ${a})` : `rgba(150, 195, 255, ${a * 0.8})`;
      c.fillRect(pad + x * (cw + pad), pad + y * (ch + pad), cw, ch);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
