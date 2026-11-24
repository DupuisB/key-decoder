# Key Decoder — Architecture

Key Decoder is a 100% client-side, offline-capable web application for visually decoding physical pin-tumbler keys from a photograph and generating print-ready, watertight 3D binary `.stl` models directly in browser memory.

## Design Principles

1. **Zero Backend / Privacy by Construction:** Photos are loaded via local browser memory (`FileReader` / `createObjectURL`) and rendered only onto local `<canvas>` elements. No network requests are ever made with user images or bitting codes.
2. **Single Source of Truth for Geometry:** Both the 2D alignment silhouette overlay and the 3D manifold `.stl` mesh derive their coordinates from the same locksmith DSD specification (`src/domain/keyways.ts`) and 2D profile solver (`src/domain/bitting.ts`).
3. **Provably Watertight 3D Meshes:** Rather than relying on fragile runtime CSG booleans, the 3D generator constructs a single conformed 2D planar triangulation (bow with keyring hole + shoulder + grooved blade) and lifts it via continuous Z-heightfields (`zBottom(x,y) < zTop(x,y)`), mathematically guaranteeing a closed, orientable, genus-1 2-manifold mesh.

---

## Module Boundaries

```
src/
├── domain/                  # Pure TypeScript domain models & locksmith DSD math (no DOM/React)
│   ├── types.ts             # KeywaySpec, WardingGroove, BittingValidation, PrintOptions, AlignmentState
│   ├── keyways.ts           # Verified locksmith DSD presets (WR5, WR3, KW1, KW10, SC1, SC4, Y1, Y2, M1, M10, LA, AR1)
│   ├── bitting.ts           # 2D bitting profile solver, cut ramps/flats, MACS validator, custom spec builder
│   ├── urlState.ts          # Optional local URL hash encoder/decoder (#keyway=...&cuts=...)
│   └── sampleKey.ts         # Deterministic synthetic brass key photo generator for instant testing
│
├── geometry/                # Pure TypeScript 3D manifold mesh & binary STL exporter (no DOM/React)
│   ├── triangulate.ts       # Planar ear-clipping triangulation with hole bridging (for bow + keyring hole)
│   ├── keyMesh.ts           # Unified 2.5D conformal key mesh builder (bow, shoulder, grooves, bitting, tip bevel)
│   ├── stlExport.ts         # Binary STL serializer, parser, and topological watertightness verifier
│   └── threeAdapter.ts      # Converts ManifoldMesh directly into Three.js BufferGeometry for WebGL preview
│
├── components/              # Focused React 19 UI components
│   ├── Header.tsx           # Minimalist top bar: branding, local-only privacy badge, dark/light mode toggle
│   ├── KeywaySelector.tsx   # Searchable keyway preset picker + DSD quick-spec readout
│   ├── CustomKeywayPanel.tsx# Collapsible advanced custom spacing/depth editor (mm or inches)
│   ├── DecoderCanvas.tsx    # Interactive 2D photo canvas: pan/zoom/flip/filters, 2+1 anchors, live 60fps overlay
│   ├── CutControls.tsx      # Tactile +/- steppers, discrete depth sliders, bitting code copy, MACS indicator
│   ├── KeyPreview3D.tsx     # Three.js WebGL interactive preview with orbit controls & build plate grid
│   └── ExportPanel.tsx      # Print tolerance controls, 3D printing advisory tooltip, one-click .stl download
│
├── hooks/
│   └── useTheme.ts          # Dark/light mode state synced with localStorage & prefers-color-scheme
│
├── App.tsx                  # Top-level application state coordinator & responsive layout
└── main.tsx                 # React 19 root mount
```

---

## Coordinate System Conventions

All geometry in `src/domain/` and `src/geometry/` uses **millimeters (mm)** internally (`1 inch = 25.4 mm` exact):

- **Origin `(0, 0, 0)`:** Intersection of the **Shoulder Stop** plane (`x = 0`), the **Blade Bottom Spine** (`y = 0`), and the **3D Printer Build Plate** (`z = 0`).
- **X-axis (Length):**
  - `x < 0`: Key bow (head) with circular keyring hole.
  - `x = 0`: Shoulder stop (Anchor A).
  - `0 <= x <= bladeLengthMm`: Blade from shoulder to tip (Anchor B at `(bladeLengthMm, 0)` or tip midpoint).
- **Y-axis (Height / Root Depth):**
  - `y = 0`: Flat bottom spine of the blade.
  - `y = profileTop(x)`: Top bitting edge. At every pin center `x_i`, `profileTop(x_i) === rootDepthMm(cut_i)` to within `< 0.001 mm`.
- **Z-axis (Thickness / Print Height):**
  - `z = 0`: Flat bottom surface resting directly on the 3D printer build plate (zero supports required).
  - `zBottom(x, y) >= 0` and `zTop(x, y) <= maxThickness`: Warding grooves are milled longitudinally into both faces of the blade with smooth runout at the shoulder (`x ∈ [0, 1.2 mm]`) and chamfered walls.

---

## Watertight Manifold Mesh Construction

1. **Top Bitting Curve `H(x)`:** Exact piecewise-linear curve along `x ∈ [0, bladeLengthMm]` formed by the lower envelope of all V-shaped pin cuts (with factory `cutFlatMm` and `cutAngleDeg`) intersected with the blank height `bladeWidthMm` and tip bevel.
2. **Conformal Groove-Cut Grid:**
   - Collect all critical `Y` coordinates of all warding grooves on both faces (`y0, y0+chamfer, y1-chamfer, y1`).
   - Collect all `X` breakpoints of `H(x)` PLUS every exact intersection `x` where `H(x)` crosses any critical groove `Y` level.
   - Within each strip `[x_k, x_{k+1}]`, subdivide vertically at every active groove `Y` level strictly below `min(H_k, H_{k+1})`. Every resulting cell is a simple quad/trapezoid/triangle whose boundary vertices match adjacent strips identically.
3. **Bow with Keyring Hole:**
   - Outer bow contour joins the exact shoulder interface vertices `(0, y_j)` along `x = 0`, stepping out to the shoulder stops and curving around the rounded key bow.
   - Inner circular keyring hole is bridged and triangulated with ear-clipping into the same vertex index space.
4. **2.5D Continuous Surface Lifting:**
   - Every 2D vertex `(x, y)` lifts to `v_bot = (x, y, zBottom(x, y))` and `v_top = (x, y, zTop(x, y))` where `zBottom < zTop` strictly everywhere.
   - Top triangles emit CCW (`+Z` normal), bottom triangles emit reversed CW (`-Z` normal), and every 2D boundary edge (outer perimeter CCW, keyring hole CW) emits a 2-triangle side wall quad with outward normal.
   - Result: every directed edge `(u -> v)` has an exact twin `(v -> u)`, Euler characteristic `V - E + F = 0` (genus 1), strictly positive signed volume, and exact factory DSD dimensions.

---

## Verification Architecture

- **Type Safety:** `tsc --noEmit` in strict mode.
- **Unit Tests (`Vitest`):**
  - DSD conversion accuracy across all 12 standard presets + Custom Keyway mode.
  - Topological manifold audit of every exported binary `.stl` (binary format compliance, half-edge pairing, Euler characteristic, outward normals, positive volume, exact blade length and per-pin root heights within `±0.01 mm`).
- **End-to-End Tests (`Playwright`):**
  - Full user journey in real headless Chromium: loading sample key, aligning anchors, stepping cuts, checking live bitting code and WebGL 3D preview without console errors, downloading and validating binary `.stl`, and capturing desktop/mobile screenshots.
