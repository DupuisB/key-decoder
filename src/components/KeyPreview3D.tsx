import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ManifoldMesh } from '../geometry/keyMesh';
import { manifoldMeshToThreeGeometry } from '../geometry/threeAdapter';
import type { Theme } from '../hooks/useTheme';

interface KeyPreview3DProps {
  mesh: ManifoldMesh;
  theme: Theme;
}

export function KeyPreview3D({ mesh, theme }: KeyPreview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const meshObjRef = useRef<THREE.Mesh | null>(null);
  const wireObjRef = useRef<THREE.LineSegments | null>(null);
  const gridObjRef = useRef<THREE.GridHelper | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [wireframe, setWireframe] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('WebGL unavailable.');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 300);
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.5, 400);
    const scale = width / height < 1.5 ? 1.35 : 1.0;
    camera.position.set(18 * scale, 34 * scale, 60 * scale);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 18;
    controls.maxDistance = 160;
    controls.target.set(0, 1.2, 0);
    controls.update();
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.15));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(32, 48, 36);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.8);
    fillLight.position.set(-30, 20, -24);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(90, 18, 0x71717a, 0x3f3f46);
    grid.position.set(0, -0.02, 0);
    scene.add(grid);
    gridObjRef.current = grid;

    const keyGroup = new THREE.Group();
    keyGroup.rotation.x = -Math.PI / 2;
    scene.add(keyGroup);

    const material = new THREE.MeshStandardMaterial({
      color: 0xd4a346,
      metalness: 0.65,
      roughness: 0.34,
    });
    const keyMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    keyGroup.add(keyMesh);
    meshObjRef.current = keyMesh;

    const wireMat = new THREE.LineBasicMaterial({ color: 0x0a84ff, transparent: true, opacity: 0.6 });
    const wireLines = new THREE.LineSegments(new THREE.BufferGeometry(), wireMat);
    wireLines.visible = false;
    keyGroup.add(wireLines);
    wireObjRef.current = wireLines;

    let animId = 0;
    const animate = () => {
      animId = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const w = Math.max(container.clientWidth, 100);
      const h = Math.max(container.clientHeight, 100);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      window.cancelAnimationFrame(animId);
      ro.disconnect();
      controls.dispose();
      keyMesh.geometry.dispose();
      material.dispose();
      wireLines.geometry.dispose();
      wireMat.dispose();
      gridObjRef.current?.geometry.dispose();
      renderer.dispose();
      meshObjRef.current = null;
      wireObjRef.current = null;
      gridObjRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const keyMesh = meshObjRef.current;
    const wireLines = wireObjRef.current;
    if (!keyMesh || !wireLines) return;

    const nextGeo = manifoldMeshToThreeGeometry(mesh);
    const cx = (mesh.bounds.minX + mesh.bounds.maxX) * 0.5;
    const cy = (mesh.bounds.minY + mesh.bounds.maxY) * 0.5;
    nextGeo.translate(-cx, -cy, 0);

    keyMesh.geometry.dispose();
    keyMesh.geometry = nextGeo;

    wireLines.geometry.dispose();
    wireLines.geometry = new THREE.EdgesGeometry(nextGeo, 18);
  }, [mesh]);

  useEffect(() => {
    if (wireObjRef.current) wireObjRef.current.visible = wireframe;
  }, [wireframe]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.background = new THREE.Color(theme === 'dark' ? 0x000000 : 0xf5f5f7);
    if (gridObjRef.current) {
      scene.remove(gridObjRef.current);
      gridObjRef.current.geometry.dispose();
    }
    const nextGrid =
      theme === 'dark'
        ? new THREE.GridHelper(90, 18, 0x3a3a3c, 0x1c1c1e)
        : new THREE.GridHelper(90, 18, 0xc7c7cc, 0xe5e5ea);
    nextGrid.position.set(0, -0.02, 0);
    scene.add(nextGrid);
    gridObjRef.current = nextGrid;
  }, [theme]);

  const setView = (preset: 'iso' | 'top') => {
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam || !ctrls) return;
    ctrls.target.set(0, 1.2, 0);
    cam.position.set(preset === 'iso' ? 18 : 0, preset === 'iso' ? 34 : 68, preset === 'iso' ? 60 : 0.1);
    ctrls.update();
  };

  const pillBtn =
    'rounded-lg bg-black/[0.06] px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-md transition hover:bg-black/[0.12] dark:bg-white/[0.12] dark:text-white/85 dark:hover:bg-white/[0.2]';

  const lenMm = (mesh.bounds.maxX - mesh.bounds.minX).toFixed(1);
  const hMm = (mesh.bounds.maxY - mesh.bounds.minY).toFixed(1);
  const tMm = (mesh.bounds.maxZ - mesh.bounds.minZ).toFixed(2);

  return (
    <div className="relative h-[54vh] min-h-[340px] w-full flex-1 lg:h-full">
      {webglError ? (
        <div className="flex h-full items-center justify-center text-xs text-black/50 dark:text-white/50">
          {webglError}
        </div>
      ) : (
        <div
          ref={mountRef}
          data-testid="preview-3d-canvas-wrap"
          className="h-full w-full cursor-grab active:cursor-grabbing"
        />
      )}

      <div className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] tabular-nums text-black/45 dark:text-white/45">
        {lenMm} × {hMm} × {tMm} mm
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-1">
        <button
          type="button"
          data-testid="toggle-wireframe-btn"
          onClick={() => setWireframe((w) => !w)}
          className={pillBtn}
        >
          Edges
        </button>
        <button type="button" onClick={() => setView('top')} className={pillBtn}>
          Top
        </button>
        <button type="button" onClick={() => setView('iso')} className={pillBtn}>
          Reset
        </button>
      </div>
    </div>
  );
}
