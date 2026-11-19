// Visual baseline from the supplied GL16 material/light reference, 2026-11-16.
export const materialPalette = Object.freeze({
  gear: { color: '#b3bcc8', metalness: .62, roughness: .38 },
  shaft: { color: '#8c9caa', metalness: .65, roughness: .38 },
  bearing: { color: '#b9c6cd', metalness: .65, roughness: .38 },
  cover: { color: '#64707d', metalness: .65, roughness: .38 },
  fastener: { color: '#647381', metalness: .65, roughness: .38 },
  housing: { color: '#a6adb6', metalness: .2, roughness: .7 },
  seal: { color: '#323c43', metalness: .65, roughness: .38 },
  belt: { color: '#323c43', metalness: .05, roughness: .75 },
});
export const selectionStyle = Object.freeze({ emissive: '#226ad8', emissiveIntensity: .32 });
export function materialOptions(category, fallback) {
  return { ...(materialPalette[category] || { color: fallback || '#8c9caa', metalness: .65, roughness: .38 }) };
}
export function highlight(material, selected) {
  material.emissive.set(selected ? selectionStyle.emissive : '#000000');
  material.emissiveIntensity = selected ? selectionStyle.emissiveIntensity : 0;
}
export function metalLighting(THREE, scene, renderer, scale = 1) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  scene.add(new THREE.HemisphereLight('#ffffff', '#a8adb5', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 3);
  key.position.set(-180 * scale, 460 * scale, 270 * scale);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -450 * scale, right: 450 * scale, top: 450 * scale, bottom: -450 * scale, near: 1, far: 1500 * scale });
  key.shadow.bias = -.001;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#dceaff', 1.8);
  fill.position.set(300 * scale, 100 * scale, -300 * scale);
  scene.add(fill);
  return { key, fill };
}
export function referenceGround(THREE, scene, { size = 1800, y = -134, z = null } = {}) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity: .09 }));
  const grid = new THREE.GridHelper(size, 50, '#aeb4bd', '#c8cdd5');
  grid.material.transparent = true; grid.material.opacity = .16;
  if (z === null) { floor.rotation.x = -Math.PI / 2; floor.position.y = y; grid.position.y = y - .5; }
  else { floor.position.z = z; grid.rotation.x = Math.PI / 2; grid.position.z = z - .5; }
  floor.receiveShadow = true; scene.add(floor, grid);
  return { floor, grid, setY(value) { floor.position.y = value; grid.position.y = value - .5; } };
}
