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
import type { Language } from '../../i18n/types';
import { LanguageSwitch } from './LanguageSwitch';
import { LightingControls } from './LightingControls';
import { JsonPlanDialog } from './JsonPlanDialog';
import { PlanExportDialog } from './PlanExportDialog';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { PRESET_FLOORPLANS } from '../../core/presets';
import { EditorTool, ViewMode } from '../../core/types';
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

export function formatTimeOfDay(hour: number, lang?: Language): string {
  const activeLang = lang ?? 'de';
  if (!Number.isFinite(hour)) {
    return activeLang === 'en' ? '12:00' : '12:00 Uhr';
  }
  const clamped = Math.max(0, Math.min(24, hour));
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60);
  const normalizedH = m === 60 ? (h + 1) % 24 : h;
  const normalizedM = m === 60 ? 0 : m;
  const time = `${String(normalizedH).padStart(2, '0')}:${String(normalizedM).padStart(2, '0')}`;
  return activeLang === 'en' ? time : `${time} Uhr`;
}

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
        projectTitle: planTitle.trim() || (language === 'en' ? 'Floorplan Plan' : 'Grundriss Plan'),
        language,
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
      setImportError(t('dialogs.json.invalidJson'));
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
        <div className="topbar-group" role="group" aria-label={t('topbar.groups.views')}>
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
        <div className="topbar-group" role="group" aria-label={t('topbar.groups.tools')}>
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
        <div className="topbar-group" role="group" aria-label={t('topbar.groups.history')}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={undo}
            disabled={!canUndo}
            title={t('topbar.actions.undoTooltip')}
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
            title={t('topbar.actions.redoTooltip')}
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
            title={t('topbar.actions.cutawayTitle')}
          >
            {cutawayEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>{t('topbar.actions.cutawayLabel')}</span>
          </button>
          <button
            type="button"
            className={`btn ${snapToWallEnabled ? 'active' : ''}`}
            onClick={() => setSnapToWallEnabled(!snapToWallEnabled)}
            title={t('topbar.actions.wallSnapping')}
          >
            <Magnet size={14} />
            <span>{t('topbar.actions.wallSnapLabel')}</span>
          </button>
          <button
            type="button"
            className={`btn ${renderTheme === 'studio' ? 'active' : ''}`}
            onClick={() =>
              setRenderTheme(renderTheme === 'studio' ? 'blueprint' : 'studio')
            }
            title={
              renderTheme === 'studio'
                ? t('topbar.actions.themeBlueprintTitle')
                : t('topbar.actions.themeStudioTitle')
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
            <span>{t('topbar.actions.dimensionsLabel')}</span>
          </button>
          <button
            type="button"
            className={`btn ${showDecor ? 'active' : ''}`}
            onClick={() => setShowDecor(!showDecor)}
            title={showDecor ? t('topbar.actions.decorTitleActive') : t('topbar.actions.decorTitleInactive')}
          >
            <span>{showDecor ? t('topbar.actions.decorLabelActive') : t('topbar.actions.decorLabelInactive')}</span>
          </button>
          <button
            type="button"
            className={`btn ${showPassageHeatmap ? 'active' : ''}`}
            aria-pressed={showPassageHeatmap}
            onClick={() => setShowPassageHeatmap(!showPassageHeatmap)}
            title={t('topbar.actions.passagesTitle')}
          >
            <Footprints size={14} />
            <span>
              {passageReport && passageReport.criticalCount > 0
                ? `${t('topbar.actions.passagesLabel')} (${passageReport.criticalCount} ⚠️)`
                : t('topbar.actions.passagesLabel')}
            </span>
          </button>
        </div>

        {/* Architectural Camera Presets */}
        <div className="topbar-group" role="group" aria-label={t('topbar.groups.camera')}>
          <Camera size={14} color="#818cf8" />
          <select
            aria-label={t('topbar.groups.camera')}
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
              {t('topbar.cameraPresets.axonometric')}
            </option>
            <option value="isometric">
              {t('topbar.cameraPresets.isometric')} 45°
            </option>
            <option value="top-down">
              {t('topbar.cameraPresets.topDown')} (Top-Down)
            </option>
            <option value="first-person">
              {t('topbar.cameraPresets.eyeLevelOption', { cm: cameraEyeLevelCm })}
            </option>
          </select>
          {cameraPreset === 'first-person' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className={`btn ${cameraEyeLevelCm === 170 ? 'active' : ''}`}
                onClick={() => setCameraEyeLevelCm(170)}
                title={t('topbar.cameraPresets.adultTitle')}
              >
                <span>170 cm</span>
              </button>
              <button
                type="button"
                className={`btn ${cameraEyeLevelCm === 115 ? 'active' : ''}`}
                onClick={() => setCameraEyeLevelCm(115)}
                title={t('topbar.cameraPresets.childTitle')}
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
                aria-label={t('topbar.cameraPresets.eyeLevelAria')}
                title={t('topbar.cameraPresets.eyeLevelTitle')}
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
          title={t('topbar.actions.exportRenderTitle')}
        >
          <span>{t('topbar.actions.exportRenderLabel')}</span>
        </button>

        {/* Preset Selector & JSON Export/Import */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            aria-label={t('topbar.actions.presetAria')}
            className="select-input"
            style={{ width: '215px' }}
            value={selectedPreset}
            onChange={(e) => {
              const key = e.target.value;
              setSelectedPreset(key);
              loadPreset(key);
            }}
          >
            {Object.entries(PRESET_FLOORPLANS).map(([key, preset]) => {
              const translatedLabel = t(`topbar.presets.${key}` as any);
              const label =
                translatedLabel && !translatedLabel.startsWith('topbar.presets.')
                  ? translatedLabel
                  : preset.label;
              return (
                <option key={key} value={key}>
                  {label}
                </option>
              );
            })}
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
            <span>{t('topbar.actions.resetLabel')}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => overlayFileInputRef.current?.click()}
            title={t('topbar.actions.overlay')}
          >
            <FileUp size={14} />
            <span>{t('topbar.actions.underlayLabel')}</span>
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
                    .setOverlayError(t('topbar.actions.underlayError'))
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
            <span>{t('topbar.actions.planSvgLabel')}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleOpenExport}
            title={t('topbar.actions.jsonExportTitle')}
          >
            <Download size={14} />
            <span>{t('topbar.actions.jsonExportLabel')}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleOpenImport}
            title={t('topbar.actions.jsonImportTitle')}
          >
            <Upload size={14} />
            <span>{t('topbar.actions.jsonImportLabel')}</span>
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
            title={t('topbar.actions.collisionTitle')}
          >
            {collisionCount === 0 ? (
              <>
                <CheckCircle2 size={14} />
                <span>{t('topbar.actions.collisionStatusZero')}</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} />
                <span>
                  {collisionCount === 1
                    ? t('topbar.actions.collisionStatusSingular')
                    : t('topbar.actions.collisionStatusPlural', { count: collisionCount })}
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
