import React, { useEffect, useId, useRef, useState } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { parseDxfFloorplan, type DxfUnit } from '../../core/import/dxfImport';
import { parseSvgFloorplan } from '../../core/import/svgImport';
import { parseRoomPlanJson } from '../../core/import/roomPlanImport';
import type { FloorplanData } from '../../core/types';

export type StructuredImportFormat = 'dxf' | 'svg' | 'roomplan';

export interface PlanImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlanImportDialog: React.FC<PlanImportDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importJson = useFloorplanStore((s) => s.importJson);

  const [format, setFormat] = useState<StructuredImportFormat>('dxf');
  const [dxfUnit, setDxfUnit] = useState<DxfUnit | 'auto'>('auto');
  const [svgCmPerUnit, setSvgCmPerUnit] = useState<number>(1);
  const [rawText, setRawText] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [previewData, setPreviewData] = useState<FloorplanData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const recomputePreview = (
    text: string,
    fmt: StructuredImportFormat,
    unit: DxfUnit | 'auto',
    cmScale: number
  ) => {
    if (!text.trim()) {
      setPreviewData(null);
      setErrorMsg(null);
      return;
    }
    try {
      let data: FloorplanData | null = null;
      if (fmt === 'dxf') {
        data = parseDxfFloorplan(text, { unit }).data;
      } else if (fmt === 'svg') {
        data = parseSvgFloorplan(text, { cmPerUnit: cmScale }).data;
      } else {
        data = parseRoomPlanJson(text)?.data ?? null;
      }
      if (!data || data.walls.length === 0) {
        setPreviewData(null);
        setErrorMsg(t('dialogs.structuredImport.emptyError'));
        return;
      }
      setPreviewData(data);
      setErrorMsg(null);
    } catch {
      setPreviewData(null);
      setErrorMsg(t('dialogs.structuredImport.parseError'));
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const lower = file.name.toLowerCase();
    const detectedFormat: StructuredImportFormat = lower.endsWith('.dxf')
      ? 'dxf'
      : lower.endsWith('.svg')
      ? 'svg'
      : 'roomplan';
    const text = await file.text();
    setFilename(file.name);
    setFormat(detectedFormat);
    setRawText(text);
    recomputePreview(text, detectedFormat, dxfUnit, svgCmPerUnit);
  };

  const handleApplyImport = () => {
    if (!previewData) return;
    const ok = importJson(JSON.stringify(previewData));
    if (ok) {
      onClose();
    } else {
      setErrorMsg(t('dialogs.structuredImport.parseError'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sidebar-title"
          id={titleId}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FileUp size={18} color="#38bdf8" />
          <span>{t('dialogs.structuredImport.title')}</span>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
          {t('dialogs.structuredImport.description')}
        </p>

        <div className="form-grid" style={{ marginTop: '6px' }}>
          <div className="form-field">
            <label className="form-label">{t('dialogs.structuredImport.formatLabel')}</label>
            <select
              className="select-input"
              value={format}
              onChange={(e) => {
                const nextFmt = e.target.value as StructuredImportFormat;
                setFormat(nextFmt);
                recomputePreview(rawText, nextFmt, dxfUnit, svgCmPerUnit);
              }}
            >
              <option value="dxf">AutoCAD DXF (.dxf)</option>
              <option value="svg">SVG Vector (.svg)</option>
              <option value="roomplan">Apple RoomPlan (.json)</option>
            </select>
          </div>

          {format === 'dxf' && (
            <div className="form-field">
              <label className="form-label">{t('dialogs.structuredImport.dxfUnit')}</label>
              <select
                className="select-input"
                value={dxfUnit}
                onChange={(e) => {
                  const nextU = e.target.value as DxfUnit | 'auto';
                  setDxfUnit(nextU);
                  recomputePreview(rawText, format, nextU, svgCmPerUnit);
                }}
              >
                <option value="auto">{t('dialogs.structuredImport.unitAuto')}</option>
                <option value="mm">mm (×0.1)</option>
                <option value="cm">cm (×1)</option>
                <option value="m">m (×100)</option>
              </select>
            </div>
          )}

          {format === 'svg' && (
            <div className="form-field">
              <label className="form-label">{t('dialogs.structuredImport.svgScale')}</label>
              <input
                type="number"
                step={0.1}
                min={0.01}
                className="number-input"
                value={svgCmPerUnit}
                onChange={(e) => {
                  const nextScale = Math.max(0.01, Number(e.target.value) || 1);
                  setSvgCmPerUnit(nextScale);
                  recomputePreview(rawText, format, dxfUnit, nextScale);
                }}
              />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".dxf,.svg,.json,application/json,image/svg+xml"
          style={{ display: 'none' }}
          onChange={(e) => void handleFileSelected(e)}
        />

        <button
          type="button"
          className="btn btn-outline"
          style={{ width: '100%' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
          <span>
            {filename || t('dialogs.structuredImport.chooseFile')}
          </span>
        </button>

        {previewData && (
          <div
            data-testid="structured-import-preview"
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#a7f3d0',
              fontSize: '0.78rem',
            }}
          >
            {t('dialogs.structuredImport.previewSummary', {
              walls: previewData.walls.length,
              openings: previewData.openings.length,
              furniture: previewData.furniture.length,
            })}
          </div>
        )}

        {errorMsg && <div className="diagnostic-box error">{errorMsg}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn active"
            disabled={!previewData}
            onClick={handleApplyImport}
          >
            {t('dialogs.structuredImport.apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
