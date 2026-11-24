import { Box, Grid3X3, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ManifoldMesh } from '../geometry/keyMesh';
import { manifoldMeshToThreeGeometry } from '../geometry/threeAdapter';
import type { Theme } from '../hooks/useTheme';

interface KeyPreview3DProps {
  mesh: ManifoldMesh;
  theme: Theme;
  keyLabel: string;
}

export function KeyPreview3D({ mesh, theme, keyLabel }: KeyPreview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const meshObjRef = useRef<THREE.Mesh | null>(null);
  const wireObjRef = useRef<THREE.LineSegments | null>(null);
  const gridObjRef = useRef<THREE.GridHelper | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [wireframe, setWireframe] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError('WebGL is unavailable in this browser context. Binary STL export still works.');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 240);
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.5, 400);
    const aspect = width / height;
    const distScale = aspect < 1.8 ? 1.42 : 1.0;
    camera.position.set(15 * distScale, 25 * distScale, 44 * distScale);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 18;
    controls.maxDistance = 160;
    controls.target.set(0, 1.2, 0);
    controls.update();
    controlsRef.current = controls;

    // Studio Lighting for brushed brass readability
    const hemi = new THREE.HemisphereLight(0xfffbeb, 0x1e293b, 1.0);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(32, 48, 36);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.9);
    fillLight.position.set(-34, 22, -26);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfde68a, 1.1);
    rimLight.position.set(10, -18, -32);
    scene.add(rimLight);

    // Build-plate reference grid (represents Z = 0 print bed in Three.js Y = 0 plane)
    const grid = new THREE.GridHelper(90, 18, 0x52525b, 0x27272a);
    grid.position.set(0, -0.02, 0);
    scene.add(grid);
    gridObjRef.current = grid;

    // Key group rotated so STL Z-up maps to Three.js Y-up (flat on print bed!)
    const keyGroup = new THREE.Group();
    keyGroup.rotation.x = -Math.PI / 2;
    scene.add(keyGroup);

    const material = new THREE.MeshStandardMaterial({
      color: 0xd9a74a,
      metalness: 0.72,
      roughness: 0.3,
    });

    const keyMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    keyGroup.add(keyMesh);
    meshObjRef.current = keyMesh;

    const wireMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
    });
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
      const scale = w / h < 1.8 ? 1.42 : 1.0;
      camera.position.set(15 * scale, 25 * scale, 44 * scale);
      controls.update();
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

  // Update Three.js geometry whenever ManifoldMesh updates
  useEffect(() => {
    const keyMesh = meshObjRef.current;
    const wireLines = wireObjRef.current;
    if (!keyMesh || !wireLines) return;

    const nextGeo = manifoldMeshToThreeGeometry(mesh);
    // Center X and Y around origin while keeping Z = 0 strictly on the build plate
    const cx = (mesh.bounds.minX + mesh.bounds.maxX) * 0.5;
    const cy = (mesh.bounds.minY + mesh.bounds.maxY) * 0.5;
    nextGeo.translate(-cx, -cy, 0);

    const oldGeo = keyMesh.geometry;
    keyMesh.geometry = nextGeo;
    oldGeo.dispose();

    const nextWire = new THREE.EdgesGeometry(nextGeo, 18);
    const oldWire = wireLines.geometry;
    wireLines.geometry = nextWire;
    oldWire.dispose();
  }, [mesh]);

  // Toggle wireframe visibility
  useEffect(() => {
    if (wireObjRef.current) {
      wireObjRef.current.visible = wireframe;
    }
  }, [wireframe]);

  // Sync scene background & build-plate grid colors to theme
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.background = new THREE.Color(theme === 'dark' ? 0x09090b : 0xf4f4f5);

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
    if (preset === 'iso') {
      cam.position.set(16, 26, 44);
    } else {
      cam.position.set(0, 56, 0.1);
    }
    ctrls.update();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Box className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            3D Print-Ready Preview
          </span>
          <span className="hidden rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 sm:inline dark:bg-zinc-800 dark:text-zinc-300">
            {keyLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWireframe((w) => !w)}
            data-testid="toggle-wireframe-btn"
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
              wireframe
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            <Grid3X3 className="h-3 w-3" />
            Edges
          </button>
          <button
            type="button"
            onClick={() => setView('top')}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => setView('iso')}
            title="Reset 3D camera"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <RotateCcw className="h-3 w-3" />
            Iso
          </button>
        </div>
      </div>

      <div className="relative h-[240px] w-full sm:h-[260px]">
        {webglError ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-zinc-500">
            {webglError}
          </div>
        ) : (
          <div ref={mountRef} data-testid="preview-3d-canvas-wrap" className="h-full w-full cursor-grab active:cursor-grabbing" />
        )}

        <div className="pointer-events-none absolute bottom-2 right-2.5 rounded bg-zinc-950/75 px-2 py-0.5 font-mono text-[10px] text-zinc-300 backdrop-blur-xs">
          Drag to orbit · Scroll to zoom · Flat on Z=0 bed
        </div>
      </div>
    </section>
  );
}
