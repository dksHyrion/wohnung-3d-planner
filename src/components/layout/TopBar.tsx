import React, { useState, useRef } from 'react';
import {
  MousePointer,
  PenTool,
  DoorOpen,
  AppWindow,
  Layers,
  Columns,
  Box,
  Eye,
  EyeOff,
  Magnet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Ruler,
  Sun,
  Moon,
  Camera,
  Undo2,
  Redo2,
  RotateCcw,
  FileText,
  FileUp,
  Footprints,
  HelpCircle,
} from 'lucide-react';
import { useFloorplanStore, CameraPreset } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { LanguageSwitch } from './LanguageSwitch';
import { LightingControls } from './LightingControls';
import { JsonPlanDialog } from './JsonPlanDialog';
import { PlanExportDialog } from './PlanExportDialog';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { PRESET_FLOORPLANS } from '../../core/presets';
import { EditorTool, ViewMode } from '../../core/types';
import { MoodPresetKey } from '../../core/lighting/moodPresets';
import { exportScaledFloorplanSvg } from '../../core/export/planSvgExport';
import { fitOverlayToViewport } from '../../core/tracingMath';
import { computeFitViewBox } from '../../core/wallMath';
import { prepareOverlayImage } from '../../core/overlayImageStore';

export async function handleOverlayImageFile(
  file: File,
  dataUrl?: string,
  dimensions?: { naturalWidth: number; naturalHeight: number }
): Promise<void> {
  try {
    const prepared = await prepareOverlayImage(file, dataUrl, dimensions);
    const freshState = useFloorplanStore.getState();
    const naturalWidth = dimensions?.naturalWidth ?? prepared.naturalWidthPx;
    const naturalHeight = dimensions?.naturalHeight ?? prepared.naturalHeightPx;
    const currentViewBox = computeFitViewBox(freshState.corners);
    const placement = fitOverlayToViewport(naturalWidth, naturalHeight, currentViewBox);

    freshState.setOverlayError(null);
    freshState.setBackgroundImage({
      id: prepared.imageId,
      imageId: prepared.imageId,
      url: prepared.url,
      filename: file.name,
      xCm: placement?.xCm ?? 0,
      zCm: placement?.zCm ?? 0,
      widthCm: placement?.widthCm ?? naturalWidth * 0.5,
      heightCm: placement?.heightCm ?? naturalHeight * 0.5,
      opacity: 0.65,
      visible: true,
      locked: false,
      rotationDeg: 0,
      naturalWidthPx: naturalWidth,
      naturalHeightPx: naturalHeight,
    });

    if (freshState.viewMode !== '2d') {
      freshState.setViewMode('2d');
    }
  } catch {
    useFloorplanStore.getState().setOverlayError('Das Grundrissbild konnte nicht gespeichert werden.');
    return;
  }
}

export function formatTimeOfDay(hour: number): string {
  if (!Number.isFinite(hour)) {
    return '12:00 Uhr';
  }
  const clamped = Math.max(0, Math.min(24, hour));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  const normalizedH = m === 60 ? (h + 1) % 24 : h;
  const normalizedM = m === 60 ? 0 : m;
  return `${String(normalizedH).padStart(2, '0')}:${String(normalizedM).padStart(2, '0')} Uhr`;
}

export const MOOD_PRESET_BUTTONS: { key: MoodPresetKey; label: string }[] = [
  { key: 'neutral', label: '🌤️ Neutral' },
  { key: 'morning', label: '🌅 Morgen' },
  { key: 'noon', label: '☀️ Mittag' },
  { key: 'golden_hour', label: '🌇 Golden Hour' },
  { key: 'blue_hour', label: '🌆 Blaue Std.' },
  { key: 'night', label: '🌙 Nacht' },
];

export function capture3DCanvasSnapshot(
  canvas: { toDataURL: (type: string) => string },
  filenamePrefix: string = 'wohnung-3d'
): boolean {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    if (typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.png`;
      if (document.body) {
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        a.click();
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to capture 3D canvas snapshot:', err);
    return false;
  }
}

export const TopBar: React.FC = () => {
  const { t, language } = useTranslation();
  const viewMode = useFloorplanStore((s) => s.viewMode);
  const activeTool = useFloorplanStore((s) => s.activeTool);
  const cutawayEnabled = useFloorplanStore((s) => s.cutawayEnabled);
  const snapToWallEnabled = useFloorplanStore((s) => s.snapToWallEnabled);
  const renderTheme = useFloorplanStore((s) => s.renderTheme);
  const showDimensions3D = useFloorplanStore((s) => s.showDimensions3D);
  const cameraPreset = useFloorplanStore((s) => s.cameraPreset);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const cameraEyeLevelCm = useFloorplanStore((s) => s.cameraEyeLevelCm);
  const showDecor = useFloorplanStore((s) => s.showDecor);
  const canUndo = useFloorplanStore((s) => s.canUndo);
  const canRedo = useFloorplanStore((s) => s.canRedo);
  const undo = useFloorplanStore((s) => s.undo);
  const redo = useFloorplanStore((s) => s.redo);
  const toggleKeyboardShortcuts = useFloorplanStore((s) => s.toggleKeyboardShortcuts);

  const setViewMode = useFloorplanStore((s) => s.setViewMode);
  const setActiveTool = useFloorplanStore((s) => s.setActiveTool);
  const setCutawayEnabled = useFloorplanStore((s) => s.setCutawayEnabled);
  const setSnapToWallEnabled = useFloorplanStore((s) => s.setSnapToWallEnabled);
  const setRenderTheme = useFloorplanStore((s) => s.setRenderTheme);
  const setShowDimensions3D = useFloorplanStore((s) => s.setShowDimensions3D);
  const setCameraPreset = useFloorplanStore((s) => s.setCameraPreset);
  const setCameraEyeLevelCm = useFloorplanStore((s) => s.setCameraEyeLevelCm);
  const setShowDecor = useFloorplanStore((s) => s.setShowDecor);
  const loadPreset = useFloorplanStore((s) => s.loadPreset);
  const exportJson = useFloorplanStore((s) => s.exportJson);
  const importJson = useFloorplanStore((s) => s.importJson);
  const showPassageHeatmap = useFloorplanStore((s) => s.showPassageHeatmap);
  const setShowPassageHeatmap = useFloorplanStore((s) => s.setShowPassageHeatmap);
  const passageReport = useFloorplanStore((s) => s.passageReport);
  const overlayError = useFloorplanStore((s) => s.overlayError);
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs = useFloorplanStore((s) => s.rugs);

  const [selectedPreset, setSelectedPreset] = useState<string>('standard-55');
  const [jsonModalMode, setJsonModalMode] = useState<'export' | 'import' | null>(null);
  const [jsonText, setJsonText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);

  const [planExportModalOpen, setPlanExportModalOpen] = useState<boolean>(false);
  const [planScale, setPlanScale] = useState<'1:50' | '1:100'>('1:50');
  const [planPaper, setPlanPaper] = useState<'A4' | 'A3'>('A4');
  const [planOrientation, setPlanOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [planIncludeFurniture, setPlanIncludeFurniture] = useState<boolean>(true);
  const [planIncludeDimensions, setPlanIncludeDimensions] = useState<boolean>(true);
  const [planTitle, setPlanTitle] = useState<string>('Grundriss Plan');

  const overlayFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadPlanSvg = () => {
    const svg = exportScaledFloorplanSvg(
      { corners, walls, openings, furniture, rugs },
      {
        scale: planScale,
        paperSize: planPaper,
        orientation: planOrientation,
        includeFurniture: planIncludeFurniture,
        includeDimensions: planIncludeDimensions,
        projectTitle: planTitle.trim() || 'Grundriss Plan',
      }
    );
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-${planScale.replace(':', '_')}-${selectedPreset}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setPlanExportModalOpen(false);
  };

  const handleExportSnapshot = () => {
    const triggerSnapshot = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('wohnung-capture-snapshot', {
            detail: { prefix: `architektur-render-${selectedPreset}` },
          })
        );
      }
    };

    if (viewMode === '2d') {
      setViewMode('3d-persp');
      setTimeout(triggerSnapshot, 250);
    } else {
      triggerSnapshot();
    }
  };

  const collisionCount = Object.values(collisionReports).filter(
    (r) => r.hasCollision
  ).length;

  const viewButtons: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: '2d', label: t('topbar.views.mode2d'), icon: <Layers size={14} /> },
    { mode: 'split', label: t('topbar.views.split'), icon: <Columns size={14} /> },
    { mode: '3d-iso', label: `3D ${t('topbar.cameraPresets.isometric')}`, icon: <Box size={14} /> },
    { mode: '3d-persp', label: `3D ${t('topbar.cameraPresets.perspective')}`, icon: <Eye size={14} /> },
  ];

  const toolButtons: { tool: EditorTool; label: string; icon: React.ReactNode }[] = [
    { tool: 'select', label: t('topbar.tools.select'), icon: <MousePointer size={14} /> },
    { tool: 'draw-wall', label: t('topbar.tools.wall'), icon: <PenTool size={14} /> },
    { tool: 'add-door', label: t('topbar.tools.door'), icon: <DoorOpen size={14} /> },
    { tool: 'add-window', label: t('topbar.tools.window'), icon: <AppWindow size={14} /> },
    { tool: 'measure', label: t('topbar.tools.measure'), icon: <Ruler size={14} /> },
  ];

  const handleOpenExport = () => {
    setJsonText(exportJson());
    setImportError(null);
    setJsonModalMode('export');
  };

  const handleDownloadJson = () => {
    const content = exportJson();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grundriss-${selectedPreset}-cm.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenImport = () => {
    setJsonText('');
    setImportError(null);
    setJsonModalMode('import');
  };

  const handleConfirmImport = () => {
    const ok = importJson(jsonText);
    if (!ok) {
      setImportError(
        'Ungültiges JSON-Format. Erwartet werden corners, walls, openings und furniture (in cm).'
      );
      return;
    }
    setJsonModalMode(null);
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-brand">
          <Ruler size={18} color="#818cf8" />
          <span>{t('topbar.brand')}</span>
          <span className="topbar-brand-badge">1 Unit = 1 cm</span>
        </div>

        {/* View Mode Switcher */}
        <div className="topbar-group" role="group" aria-label={t('topbar.views.mode2d')}>
          {viewButtons.map((btn) => (
            <button
              key={btn.mode}
              type="button"
              className={`btn ${viewMode === btn.mode ? 'active' : ''}`}
              onClick={() => setViewMode(btn.mode)}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* 2D Editor Tool Selector */}
        <div className="topbar-group" role="group" aria-label={t('topbar.tools.select')}>
          {toolButtons.map((btn) => (
            <button
              key={btn.tool}
              type="button"
              className={`btn ${activeTool === btn.tool ? 'active' : ''}`}
              onClick={() => setActiveTool(btn.tool)}
            >
              {btn.icon}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Undo / Redo History */}
        <div className="topbar-group" role="group" aria-label="Verlauf">
          <button
            type="button"
            className="btn btn-outline"
            onClick={undo}
            disabled={!canUndo}
            title={`${t('topbar.actions.undo')} (Ctrl+Z)`}
            style={{ opacity: canUndo ? 1 : 0.45 }}
          >
            <Undo2 size={14} />
            <span>{t('topbar.actions.undo')}</span>
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={redo}
            disabled={!canRedo}
            title={`${t('topbar.actions.redo')} (Ctrl+Y)`}
            style={{ opacity: canRedo ? 1 : 0.45 }}
          >
            <Redo2 size={14} />
            <span>{t('topbar.actions.redo')}</span>
          </button>
        </div>

        {/* Cutaway & Wall-Snap Toggles */}
        <div className="topbar-group">
          <button
            type="button"
            className={`btn ${cutawayEnabled ? 'active' : ''}`}
            onClick={() => setCutawayEnabled(!cutawayEnabled)}
            title={
              language === 'en'
                ? 'Lower front walls to 30 cm in 3D automatically (Cutaway)'
                : 'Vordere Wände in 3D automatisch auf 30 cm absenken (Cutaway)'
            }
          >
            {cutawayEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{language === 'en' ? 'Cutaway Walls' : 'Cutaway-Wände'}</span>
          </button>
          <button
            type="button"
            className={`btn ${snapToWallEnabled ? 'active' : ''}`}
            onClick={() => setSnapToWallEnabled(!snapToWallEnabled)}
            title={t('topbar.actions.wallSnapping')}
          >
            <Magnet size={14} />
            <span>{language === 'en' ? 'Wall Snap' : 'Wand-Snap'}</span>
          </button>
          <button
            type="button"
            className={`btn ${renderTheme === 'studio' ? 'active' : ''}`}
            onClick={() =>
              setRenderTheme(renderTheme === 'studio' ? 'blueprint' : 'studio')
            }
            title={
              renderTheme === 'studio'
                ? (language === 'en' ? 'Switch to Blueprint Dark' : 'Zu Blueprint Dark wechseln')
                : (language === 'en' ? 'Switch to Studio Render' : 'Zu Studio Render wechseln')
            }
          >
            {renderTheme === 'studio' ? <Sun size={14} /> : <Moon size={14} />}
            <span>{renderTheme === 'studio' ? 'Studio' : 'Blueprint'}</span>
          </button>
          <button
            type="button"
            className={`btn ${showDimensions3D ? 'active' : ''}`}
            onClick={() => setShowDimensions3D(!showDimensions3D)}
            title={t('topbar.actions.dimensions')}
          >
            <Ruler size={14} />
            <span>{language === 'en' ? 'Dimensions 3D' : 'Maße 3D'}</span>
          </button>
          <button
            type="button"
            className={`btn ${showDecor ? 'active' : ''}`}
            onClick={() => setShowDecor(!showDecor)}
            title={
              language === 'en'
                ? showDecor
                  ? 'Decorations enabled (Click to hide for honest test)'
                  : 'Decorations hidden (Honest architectural mode)'
                : showDecor
                ? 'Dekoration eingeblendet (Klicken zum Ausblenden für ehrliche Stellprobe)'
                : 'Dekoration ausgeblendet (Ehrlicher Architektur-Modus)'
            }
          >
            <span>{showDecor ? (language === 'en' ? '✨ Decor' : '✨ Deko') : '📐 Clean'}</span>
          </button>
          <button
            type="button"
            className={`btn ${showPassageHeatmap ? 'active' : ''}`}
            aria-pressed={showPassageHeatmap}
            onClick={() => setShowPassageHeatmap(!showPassageHeatmap)}
            title={
              language === 'en'
                ? 'Passages & Clearances according to DIN 18040 (Min width 90 cm / critical < 60 cm)'
                : 'Laufwege & Durchgangsbreiten nach DIN 18040 (Mindestbreite 90 cm / kritisch < 60 cm)'
            }
          >
            <Footprints size={14} />
            <span>
              {passageReport && passageReport.criticalCount > 0
                ? `${language === 'en' ? 'Passages' : 'Laufwege'} (${passageReport.criticalCount} ⚠️)`
                : language === 'en' ? 'Passages' : 'Laufwege'}
            </span>
          </button>
        </div>

        {/* Architectural Camera Presets */}
        <div className="topbar-group" role="group" aria-label={t('topbar.cameraPresets.perspective')}>
          <Camera size={14} color="#818cf8" />
          <select
            aria-label={t('topbar.cameraPresets.perspective')}
            className="select-input"
            style={{ width: '210px' }}
            value={cameraPreset}
            onChange={(e) => {
              const val = e.target.value as CameraPreset;
              setCameraPreset(val);
              if (viewMode === '2d') {
                setViewMode('3d-persp');
              }
            }}
          >
            <option value="axonometric">
              {language === 'en' ? 'Axonometric 65°' : 'Axonometrie 65°'}
            </option>
            <option value="isometric">
              {t('topbar.cameraPresets.isometric')} 45°
            </option>
            <option value="top-down">
              {t('topbar.cameraPresets.topDown')} (Top-Down)
            </option>
            <option value="first-person">
              👤 {language === 'en' ? 'First-Person' : 'Augenhöhe'} ({cameraEyeLevelCm} cm)
            </option>
          </select>
          {cameraPreset === 'first-person' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className={`btn ${cameraEyeLevelCm === 170 ? 'active' : ''}`}
                onClick={() => setCameraEyeLevelCm(170)}
                title={language === 'en' ? 'Eye level: 170 cm (Adult)' : 'Augenhöhe: 170 cm (Erwachsener)'}
              >
                <span>170 cm</span>
              </button>
              <button
                type="button"
                className={`btn ${cameraEyeLevelCm === 115 ? 'active' : ''}`}
                onClick={() => setCameraEyeLevelCm(115)}
                title={language === 'en' ? 'Eye level: 115 cm (Child / Seated)' : 'Augenhöhe: 115 cm (Kind / Sitzend)'}
              >
                <span>115 cm</span>
              </button>
              <input
                type="number"
                min={50}
                max={250}
                step={5}
                value={cameraEyeLevelCm}
                onChange={(e) => setCameraEyeLevelCm(Number(e.target.value) || 170)}
                aria-label={language === 'en' ? 'Eye level in cm' : 'Augenhöhe in cm'}
                title={language === 'en' ? 'Adjust eye level manually (50–250 cm)' : 'Augenhöhe manuell anpassen (50–250 cm)'}
                className="select-input"
                style={{ width: '60px', padding: '2px 4px', textAlign: 'center' }}
              />
            </div>
          )}
        </div>

        {/* Atmosphere & Lighting Controls (only when 3D is active) */}
        <LightingControls />

        {/* Render PNG Snapshot Export */}
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleExportSnapshot}
          title={
            language === 'en'
              ? 'Export 3D rendering as high-resolution PNG image'
              : '3D-Rendering als hochauflösendes PNG-Bild exportieren'
          }
        >
          <span>📸 {language === 'en' ? 'Export Render' : 'Render exportieren'}</span>
        </button>

        {/* Preset Selector & JSON Export/Import */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            aria-label={language === 'en' ? 'Floorplan Preset' : 'Grundriss-Vorlage'}
            className="select-input"
            style={{ width: '215px' }}
            value={selectedPreset}
            onChange={(e) => {
              const key = e.target.value;
              setSelectedPreset(key);
              loadPreset(key);
            }}
          >
            {Object.entries(PRESET_FLOORPLANS).map(([key, preset]) => (
              <option key={key} value={key}>
                {preset.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setSelectedPreset('standard-55');
              loadPreset('standard-55');
            }}
            title={t('topbar.actions.resetPlan')}
          >
            <RotateCcw size={14} />
            <span>{language === 'en' ? 'Reset' : 'Neu'}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => overlayFileInputRef.current?.click()}
            title={t('topbar.actions.overlay')}
          >
            <FileUp size={14} />
            <span>{language === 'en' ? 'Underlay' : 'Unterleger'}</span>
          </button>
          {overlayError && <span className="form-label">{overlayError}</span>}
          <input
            ref={overlayFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleOverlayImageFile(file).catch(() =>
                  useFloorplanStore
                    .getState()
                    .setOverlayError('Das Grundrissbild konnte nicht gespeichert werden.')
                );
              }
              e.target.value = '';
            }}
          />

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPlanExportModalOpen(true)}
            title={t('topbar.actions.export')}
          >
            <FileText size={14} />
            <span>Plan (SVG)</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleOpenExport}
            title={t('topbar.actions.json')}
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleOpenImport}
            title={language === 'en' ? 'Import floorplan from JSON' : 'Grundriss aus JSON importieren'}
          >
            <Upload size={14} />
            <span>Import</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={toggleKeyboardShortcuts}
            title={t('topbar.actions.shortcuts')}
            aria-label={t('topbar.actions.shortcuts')}
          >
            <HelpCircle size={14} />
          </button>

          <LanguageSwitch />

          {/* Global Collision Status Badge */}
          <div
            className={`status-badge ${collisionCount === 0 ? 'ok' : 'conflict'}`}
            title={
              language === 'en'
                ? 'Live collision check (1D wall projection & 3D OBB)'
                : 'Live-Kollisionsprüfung (1D Wandprojektion & 3D OBB)'
            }
          >
            {collisionCount === 0 ? (
              <>
                <CheckCircle2 size={14} />
                <span>{language === 'en' ? '0 Conflicts' : '0 Konflikte'}</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} />
                <span>
                  {collisionCount}{' '}
                  {collisionCount === 1
                    ? (language === 'en' ? 'Conflict' : 'Kollision')
                    : (language === 'en' ? 'Conflicts' : 'Kollisionen')}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <JsonPlanDialog
        jsonModalMode={jsonModalMode}
        setJsonModalMode={setJsonModalMode}
        jsonText={jsonText}
        setJsonText={setJsonText}
        importError={importError}
        handleDownloadJson={handleDownloadJson}
        handleConfirmImport={handleConfirmImport}
      />
      <PlanExportDialog
        planExportModalOpen={planExportModalOpen}
        setPlanExportModalOpen={setPlanExportModalOpen}
        planScale={planScale}
        setPlanScale={setPlanScale}
        planPaper={planPaper}
        setPlanPaper={setPlanPaper}
        planOrientation={planOrientation}
        setPlanOrientation={setPlanOrientation}
        planIncludeFurniture={planIncludeFurniture}
        setPlanIncludeFurniture={setPlanIncludeFurniture}
        planIncludeDimensions={planIncludeDimensions}
        setPlanIncludeDimensions={setPlanIncludeDimensions}
        planTitle={planTitle}
        setPlanTitle={setPlanTitle}
        handleDownloadPlanSvg={handleDownloadPlanSvg}
      />
      <KeyboardShortcutsDialog />
    </>
  );
};
