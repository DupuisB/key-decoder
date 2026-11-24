import { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomKeywayPanel } from './components/CustomKeywayPanel';
import { CutControls } from './components/CutControls';
import { DecoderCanvas } from './components/DecoderCanvas';
import { ExportPanel } from './components/ExportPanel';
import { type AppMode, Header } from './components/Header';
import { KeyPreview3D } from './components/KeyPreview3D';
import { KeywaySelector } from './components/KeywaySelector';
import { ScreenTraceMode } from './components/ScreenTraceMode';
import { buildCustomKeywaySpec, clampCutsToSpec, formatBittingCode } from './domain/bitting';
import { DEFAULT_KEYWAY_ID, getKeywayById, KEYWAY_PRESETS } from './domain/keyways';
import { generateSampleKeyPhoto } from './domain/sampleKey';
import type { AnchorAlignment, CustomKeywayInput, KeywaySpec, PrintOptions } from './domain/types';
import { decodeStateFromHash, encodeStateToHash } from './domain/urlState';
import { buildKeyMesh, DEFAULT_PRINT_OPTIONS } from './geometry/keyMesh';
import { exportMeshToBinaryStl } from './geometry/stlExport';
import { useTheme } from './hooks/useTheme';

const DEFAULT_ALIGNMENT: AnchorAlignment = {
  shoulderTop: { x: 0.36, y: 0.38 },
  angleDeg: 0,
  bladeWidthRatio: 0.21,
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
  bladeWidth: 0.318,
  bladeLength: 1.09,
  bladeThickness: 0.083,
  cutFlat: 0.062,
  cutAngleDeg: 100,
  macs: 6,
};

function getInitialSpecAndCuts(): { spec: KeywaySpec; cuts: number[] } {
  const defaultSpec = getKeywayById(DEFAULT_KEYWAY_ID) ?? KEYWAY_PRESETS[0]!;
  if (typeof window !== 'undefined' && window.location.hash) {
    const decoded = decodeStateFromHash(window.location.hash);
    if (decoded) {
      const found = getKeywayById(decoded.keywayId);
      if (found) return { spec: found, cuts: decoded.cuts };
    }
  }
  return { spec: defaultSpec, cuts: [...defaultSpec.defaultCuts] };
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const initial = useMemo(() => getInitialSpecAndCuts(), []);

  const [mode, setMode] = useState<AppMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'screen' : 'decode',
  );
  const [selectedSpec, setSelectedSpec] = useState<KeywaySpec>(initial.spec);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState<CustomKeywayInput>(DEFAULT_CUSTOM_INPUT);
  const [cuts, setCuts] = useState<number[]>(initial.cuts);
  const [activePinIndex, setActivePinIndex] = useState<number | null>(null);
  const [alignment, setAlignment] = useState<AnchorAlignment>(DEFAULT_ALIGNMENT);
  const [printOptions, setPrintOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isObjectUrl, setIsObjectUrl] = useState(false);

  useEffect(() => {
    return () => {
      if (isObjectUrl && imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl, isObjectUrl]);

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
      if (isObjectUrl && imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(file));
      setIsObjectUrl(true);
      setAlignment(DEFAULT_ALIGNMENT);
      setMode('decode');
    },
    [imageUrl, isObjectUrl],
  );

  const handleLoadSample = useCallback(() => {
    if (isObjectUrl && imageUrl) URL.revokeObjectURL(imageUrl);
    const sampleCuts = [...selectedSpec.defaultCuts];
    const sample = generateSampleKeyPhoto(selectedSpec, sampleCuts);
    setImageUrl(sample.dataUrl);
    setIsObjectUrl(false);
    setAlignment(sample.initialAlignment);
    setCuts(sampleCuts);
    setMode('decode');
  }, [imageUrl, isObjectUrl, selectedSpec]);

  const handleCopyShareLink = useCallback(() => {
    const hash = encodeStateToHash(selectedSpec.id, cuts);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
  }, [cuts, selectedSpec.id]);

  const manifoldMesh = useMemo(
    () => buildKeyMesh(selectedSpec, cuts, printOptions),
    [selectedSpec, cuts, printOptions],
  );

  const handleDownloadStl = useCallback(() => {
    const code = selectedSpec.code.replace(/[^A-Za-z0-9_-]/g, '');
    const fileName = `${code}-${formatBittingCode(cuts, '')}.stl`;
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

  return (
    <div className="flex min-h-dvh flex-col bg-white text-[#1d1d1f] lg:h-dvh lg:overflow-hidden dark:bg-black dark:text-[#f5f5f7]">
      <Header mode={mode} onChangeMode={setMode} theme={theme} onToggleTheme={toggleTheme} />

      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* Full-bleed primary workspace */}
        <section className="flex min-w-0 flex-1 flex-col">
          {mode === 'decode' ? (
            <DecoderCanvas
              spec={selectedSpec}
              cuts={cuts}
              imageUrl={imageUrl}
              alignment={alignment}
              activePinIndex={activePinIndex}
              onChangeAlignment={setAlignment}
              onUploadFile={handleUploadFile}
              onLoadSample={handleLoadSample}
              onSelectPin={setActivePinIndex}
              onChangeCut={handleChangeCut}
            />
          ) : mode === 'screen' ? (
            <ScreenTraceMode spec={selectedSpec} cuts={cuts} activePinIndex={activePinIndex} />
          ) : (
            <KeyPreview3D mesh={manifoldMesh} theme={theme} />
          )}
        </section>

        {/* Clean hairline-separated inspector (right on desktop, flush bottom on mobile) */}
        <aside className="flex shrink-0 flex-col divide-y divide-black/8 border-t border-black/8 bg-white lg:w-[320px] lg:overflow-y-auto lg:border-t-0 lg:border-l dark:divide-white/10 dark:border-white/10 dark:bg-[#1c1c1e]">
          <div className="p-4">
            <KeywaySelector
              selectedSpec={selectedSpec}
              isCustomMode={isCustomMode}
              onSelectPreset={handleSelectPreset}
              onToggleCustomMode={handleToggleCustomMode}
            />
            {isCustomMode && (
              <CustomKeywayPanel initialInput={customInput} onApply={handleApplyCustom} />
            )}
          </div>

          <div className="p-4">
            <CutControls
              spec={selectedSpec}
              cuts={cuts}
              activePinIndex={activePinIndex}
              onSelectPin={setActivePinIndex}
              onChangeCut={handleChangeCut}
              onResetCuts={handleResetCuts}
              onCopyShareLink={handleCopyShareLink}
            />
          </div>

          <div className="p-4">
            <ExportPanel
              spec={selectedSpec}
              cuts={cuts}
              printOptions={printOptions}
              onChangePrintOptions={setPrintOptions}
              onDownloadStl={handleDownloadStl}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
