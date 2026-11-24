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
      setWebglError('WebGL unavailable. STL download still works.');
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

    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.1));
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

    const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
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
    scene.background = new THREE.Color(theme === 'dark' ? 0x18181b : 0xf4f4f5);
    if (gridObjRef.current) {
      scene.remove(gridObjRef.current);
      gridObjRef.current.geometry.dispose();
    }
    const nextGrid =
      theme === 'dark'
        ? new THREE.GridHelper(90, 18, 0x52525b, 0x27272a)
        : new THREE.GridHelper(90, 18, 0xa1a1aa, 0xd4d4d8);
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

  const btnCls =
    'rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';

  const lenMm = (mesh.bounds.maxX - mesh.bounds.minX).toFixed(1);
  const hMm = (mesh.bounds.maxY - mesh.bounds.minY).toFixed(1);
  const tMm = (mesh.bounds.maxZ - mesh.bounds.minZ).toFixed(2);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {lenMm} × {hMm} × {tMm} mm
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="toggle-wireframe-btn"
            onClick={() => setWireframe((w) => !w)}
            className={btnCls}
          >
            {wireframe ? 'Hide edges' : 'Edges'}
          </button>
          <button type="button" onClick={() => setView('top')} className={btnCls}>
            Top
          </button>
          <button type="button" onClick={() => setView('iso')} className={btnCls}>
            Reset
          </button>
        </div>
      </div>

      <div className="h-[420px] w-full sm:h-[520px]">
        {webglError ? (
          <div className="flex h-full items-center justify-center p-4 text-xs text-zinc-500">
            {webglError}
          </div>
        ) : (
          <div
            ref={mountRef}
            data-testid="preview-3d-canvas-wrap"
            className="h-full w-full cursor-grab active:cursor-grabbing"
          />
        )}
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        Drag to rotate, scroll to zoom. Model rests flat on the build plate (Z = 0).
      </div>
    </div>
  );
}
