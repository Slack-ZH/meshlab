import * as THREE from './three.module.js';

// GL16 reference capture, 2026-11-16. Values describe the rendered appearance.
export const finishes = {
  gear: {color:0xb3bcc8, metalness:.62, roughness:.38},
  shaft: {color:0x8c9caa, metalness:.65, roughness:.38},
  bearing: {color:0xb9c6cd, metalness:.65, roughness:.38},
  fastener: {color:0x647381, metalness:.65, roughness:.38},
  cover: {color:0x64707d, metalness:.65, roughness:.38},
  housing: {color:0xa6adb6, metalness:.20, roughness:.70},
  rubber: {color:0x323c43, metalness:.03, roughness:.86},
};

export function setPartHighlight(parts, selected) {
  for (const part of parts) {
    const active = part.id === selected;
    part.group.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.material.emissive.setHex(active ? 0x226ad8 : 0);
      mesh.material.emissiveIntensity = active ? .32 : 0;
    });
  }
}

export function createReferenceStage(scene, renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sky = new THREE.HemisphereLight(0xffffff, 0xa8adb5, 2.2);
  const key = new THREE.DirectionalLight(0xffffff, 3);
  const fill = new THREE.DirectionalLight(0xdceaff, 1.8);
  const keyDirection = new THREE.Vector3(-180, 460, 270).normalize();
  const fillDirection = new THREE.Vector3(300, 100, -300).normalize();
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -.001;
  scene.add(sky, key, fill, key.target, fill.target);

  const grid = new THREE.GridHelper(1, 50, 0xaeb4bd, 0xc8cdd5);
  grid.material.transparent = true;
  grid.material.depthWrite = false;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const ground = new THREE.Group();
  ground.add(grid, floor);
  ground.visible = false;
  scene.add(ground);

  return {
    fit(bounds, center) {
      const span = bounds.getSize(new THREE.Vector3()).length();
      key.target.position.copy(center);
      key.position.copy(center).addScaledVector(keyDirection, span * 1.5);
      fill.target.position.copy(center);
      fill.position.copy(center).addScaledVector(fillDirection, span * 1.5);
      Object.assign(key.shadow.camera, {
        left:-span, right:span, top:span, bottom:-span, near:1, far:span * 3,
      });
      key.shadow.camera.updateProjectionMatrix();
      const groundSize = span * 2.5;
      ground.position.set(center.x, bounds.min.y - span * .015, center.z);
      grid.scale.setScalar(groundSize);
      grid.position.y = -span * .001;
      floor.scale.setScalar(groundSize);
      ground.visible = true;
    },
    setDark(dark) {
      grid.material.opacity = dark ? .09 : .16;
      floor.material.opacity = dark ? .22 : .09;
    },
    dispose() {
      scene.remove(ground, sky, key, fill, key.target, fill.target);
      key.dispose();
      grid.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
    },
  };
}

export function fitReferenceCamera(host, camera, controls, center, boxes) {
  const viewport = host.getBoundingClientRect();
  const {width, height} = viewport;
  if (!width || !height) return;

  const panel = host.closest('.viewer-panel');
  const header = panel.querySelector('.viewer-top').getBoundingClientRect();
  const tools = panel.querySelector('.view-tools').getBoundingClientRect();
  const hint = panel.querySelector('.view-hint').getBoundingClientRect();
  const left = 14;
  const right = width < 600 ? Math.max(14, viewport.right - tools.left + 8) : 14;
  const top = Math.max(10, header.bottom - viewport.top + 8);
  const bottom = Math.max(16, viewport.bottom - hint.top + 8);
  const availableWidth = Math.max(width - left - right, width * .6);
  const availableHeight = Math.max(height - top - bottom, height * .6);
  camera.setViewOffset(width, height, (right - left) / 2, (bottom - top) / 2, width, height);

  const direction = camera.position.clone().sub(controls.target).normalize();
  const horizontal = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const vertical = new THREE.Vector3().crossVectors(direction, horizontal);
  const halfFov = Math.tan(camera.fov * Math.PI / 360);
  const tv = halfFov * availableHeight / height;
  const th = halfFov * availableWidth / height;
  let distance = 0;
  for (const box of boxes) {
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(center);
          const extent = Math.max(Math.abs(corner.dot(horizontal)) / th, Math.abs(corner.dot(vertical)) / tv);
          distance = Math.max(distance, corner.dot(direction) + extent);
        }
      }
    }
  }
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance * 1.04);
  controls.update();
}

// Preserve the outer diameter, bore and face-to-face thickness at the chamfer.
export function machinedRing(outer, inner, depth) {
  const face = depth / 2;
  const bevel = Math.min(.8, depth / 4, (outer - inner) / 4);
  const profile = [
    [inner, -face + bevel], [inner + bevel, -face], [outer - bevel, -face],
    [outer, -face + bevel], [outer, face - bevel], [outer - bevel, face],
    [inner + bevel, face], [inner, face - bevel], [inner, -face + bevel],
  ];
  const geometry = new THREE.LatheGeometry(profile.map(([r, y])=>new THREE.Vector2(r, y)), 96);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
