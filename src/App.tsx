import { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomKeywayPanel } from './components/CustomKeywayPanel';
import { CutControls } from './components/CutControls';
import { DecoderCanvas } from './components/DecoderCanvas';
import { ExportPanel } from './components/ExportPanel';
import { Header } from './components/Header';
import { KeyPreview3D } from './components/KeyPreview3D';
import { KeywaySelector } from './components/KeywaySelector';
import { buildCustomKeywaySpec, clampCutsToSpec, formatBittingCode } from './domain/bitting';
import { DEFAULT_KEYWAY_ID, getKeywayById, KEYWAY_PRESETS } from './domain/keyways';
import { generateSampleKeyPhoto } from './domain/sampleKey';
import type { AnchorAlignment, CustomKeywayInput, KeywaySpec, PrintOptions } from './domain/types';
import { decodeStateFromHash, encodeStateToHash } from './domain/urlState';
import { buildKeyMesh, DEFAULT_PRINT_OPTIONS } from './geometry/keyMesh';
import { exportMeshToBinaryStl } from './geometry/stlExport';
import { useTheme } from './hooks/useTheme';

const DEFAULT_ALIGNMENT: AnchorAlignment = {
  shoulder: { x: 0.36, y: 0.56 },
  tip: { x: 0.76, y: 0.56 },
  rotationOffsetDeg: 0,
  scaleMultiplier: 1,
  heightScaleMultiplier: 1,
  skewY: 0,
  flipVertical: false,
};

const DEFAULT_CUSTOM_INPUT: CustomKeywayInput = {
  name: 'Custom 5-Pin',
  unit: 'in',
  spaces: [0.237, 0.393, 0.549, 0.705, 0.861],
  rootDepths: [0.315, 0.297, 0.279, 0.261, 0.243, 0.225, 0.207, 0.189, 0.171, 0.153],
  depthMin: 0,
  bladeWidth: 0.335,
  bladeLength: 1.075,
  bladeThickness: 0.083,
  cutFlat: 0.045,
  cutAngleDeg: 90,
  macs: 6,
};

function getInitialSpecAndCuts(): { spec: KeywaySpec; cuts: number[] } {
  const defaultSpec = getKeywayById(DEFAULT_KEYWAY_ID) ?? KEYWAY_PRESETS[0]!;
  if (typeof window !== 'undefined' && window.location.hash) {
    const decoded = decodeStateFromHash(window.location.hash);
    if (decoded) {
      const found = getKeywayById(decoded.keywayId);
      if (found) {
        return { spec: found, cuts: decoded.cuts };
      }
    }
  }
  return { spec: defaultSpec, cuts: [...defaultSpec.defaultCuts] };
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const initial = useMemo(() => getInitialSpecAndCuts(), []);

  const [selectedSpec, setSelectedSpec] = useState<KeywaySpec>(initial.spec);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState<CustomKeywayInput>(DEFAULT_CUSTOM_INPUT);
  const [cuts, setCuts] = useState<number[]>(initial.cuts);
  const [activePinIndex, setActivePinIndex] = useState<number | null>(null);
  const [alignment, setAlignment] = useState<AnchorAlignment>(DEFAULT_ALIGNMENT);
  const [printOptions, setPrintOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLabel, setImageLabel] = useState<string | null>(null);
  const [isObjectUrl, setIsObjectUrl] = useState(false);

  // Revoke previous object URL when replaced or unmounted
  useEffect(() => {
    return () => {
      if (isObjectUrl && imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl, isObjectUrl]);

  // Keep URL hash in sync locally (only for standard presets)
  useEffect(() => {
    if (isCustomMode) return;
    const nextHash = encodeStateToHash(selectedSpec.id, cuts);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [selectedSpec.id, cuts, isCustomMode]);

  const handleSelectPreset = useCallback((nextSpec: KeywaySpec) => {
    setIsCustomMode(false);
    setSelectedSpec(nextSpec);
    setCuts([...nextSpec.defaultCuts]);
    setActivePinIndex(null);
  }, []);

  const handleToggleCustomMode = useCallback(() => {
    setIsCustomMode((prev) => {
      const next = !prev;
      if (next) {
        const built = buildCustomKeywaySpec(customInput);
        setSelectedSpec(built);
        setCuts(clampCutsToSpec(built, built.defaultCuts));
      } else {
        const fallback = getKeywayById(DEFAULT_KEYWAY_ID) ?? KEYWAY_PRESETS[0]!;
        setSelectedSpec(fallback);
        setCuts([...fallback.defaultCuts]);
      }
      return next;
    });
  }, [customInput]);

  const handleApplyCustom = useCallback((input: CustomKeywayInput) => {
    setCustomInput(input);
    const built = buildCustomKeywaySpec(input);
    setSelectedSpec(built);
    setCuts(clampCutsToSpec(built, built.defaultCuts));
    setIsCustomMode(true);
  }, []);

  const handleChangeCut = useCallback(
    (pinIndex: number, nextDepth: number) => {
      const clamped = Math.max(selectedSpec.depthMin, Math.min(selectedSpec.depthMax, Math.round(nextDepth)));
      setCuts((prev) => {
        const next = [...prev];
        next[pinIndex] = clamped;
        return next;
      });
    },
    [selectedSpec.depthMax, selectedSpec.depthMin],
  );

  const handleResetCuts = useCallback(() => {
    setCuts([...selectedSpec.defaultCuts]);
  }, [selectedSpec.defaultCuts]);

  const handleUploadFile = useCallback(
    (file: File) => {
      if (isObjectUrl && imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      const nextUrl = URL.createObjectURL(file);
      setImageUrl(nextUrl);
      setIsObjectUrl(true);
      setImageLabel(file.name);
      setAlignment(DEFAULT_ALIGNMENT);
    },
    [imageUrl, isObjectUrl],
  );

  const handleLoadSample = useCallback(() => {
    if (isObjectUrl && imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    const sampleCuts = [...selectedSpec.defaultCuts];
    const sample = generateSampleKeyPhoto(selectedSpec, sampleCuts);
    setImageUrl(sample.dataUrl);
    setIsObjectUrl(false);
    setImageLabel(`Sample ${selectedSpec.code} (${formatBittingCode(sampleCuts, '-')})`);
    setAlignment(sample.initialAlignment);
    // Start user cuts slightly offset by 1 step on pins 2 and 4 so shape-matching is immediately demonstrable,
    // or exact default? Keep default cuts matching cleanly so user sees instant alignment and can tweak!
    setCuts(sampleCuts);
  }, [imageUrl, isObjectUrl, selectedSpec]);

  const handleCopyShareLink = useCallback(() => {
    const hash = encodeStateToHash(selectedSpec.id, cuts);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {
      // Ignore clipboard failures in restricted environments
    });
  }, [cuts, selectedSpec.id]);

  // Procedural watertight 3D manifold mesh (recomputed instantaneously < 5ms)
  const manifoldMesh = useMemo(
    () => buildKeyMesh(selectedSpec, cuts, printOptions),
    [selectedSpec, cuts, printOptions],
  );

  const handleDownloadStl = useCallback(() => {
    const code = selectedSpec.code.replace(/[^A-Za-z0-9_-]/g, '');
    const bittingCompact = formatBittingCode(cuts, '');
    const fileName = `${code}-${bittingCompact}.stl`;
    const header = `KeyDecoder ${code} ${formatBittingCode(cuts, '-')} (mm watertight)`;
    const buffer = exportMeshToBinaryStl(manifoldMesh, header);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [cuts, manifoldMesh, selectedSpec.code]);

  const keyLabel = `${selectedSpec.code} · ${formatBittingCode(cuts, '-')}`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-100">
      <Header theme={theme} onToggleTheme={toggleTheme} />

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left Primary Workspace: 2D Alignment Overlay + Live 3D STL Preview */}
        <div className="flex min-w-0 flex-col gap-4">
          <DecoderCanvas
            spec={selectedSpec}
            cuts={cuts}
            imageUrl={imageUrl}
            imageLabel={imageLabel}
            alignment={alignment}
            activePinIndex={activePinIndex}
            onChangeAlignment={setAlignment}
            onUploadFile={handleUploadFile}
            onLoadSample={handleLoadSample}
            onSelectPin={setActivePinIndex}
            onChangeCut={handleChangeCut}
          />

          <KeyPreview3D mesh={manifoldMesh} theme={theme} keyLabel={keyLabel} />
        </div>

        {/* Right Engineering Controls Sidebar */}
        <aside className="flex flex-col gap-4">
          <KeywaySelector
            selectedSpec={selectedSpec}
            isCustomMode={isCustomMode}
            onSelectPreset={handleSelectPreset}
            onToggleCustomMode={handleToggleCustomMode}
          />

          {isCustomMode && (
            <CustomKeywayPanel initialInput={customInput} onApply={handleApplyCustom} />
          )}

          <CutControls
            spec={selectedSpec}
            cuts={cuts}
            activePinIndex={activePinIndex}
            onSelectPin={setActivePinIndex}
            onChangeCut={handleChangeCut}
            onResetCuts={handleResetCuts}
            onCopyShareLink={handleCopyShareLink}
          />

          <ExportPanel
            spec={selectedSpec}
            cuts={cuts}
            printOptions={printOptions}
            mesh={manifoldMesh}
            onChangePrintOptions={setPrintOptions}
            onDownloadStl={handleDownloadStl}
          />
        </aside>
      </main>
    </div>
  );
}
export default App;
