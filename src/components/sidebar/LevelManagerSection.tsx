import React, { useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { LevelViewMode } from '../../core/types';

export const LevelManagerSection: React.FC = () => {
  const { t } = useTranslation();
  const levels = useFloorplanStore((s) => s.levels);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const levelViewMode = useFloorplanStore((s) => s.levelViewMode);
  const showGhostBelow2D = useFloorplanStore((s) => s.showGhostBelow2D);
  const addLevel = useFloorplanStore((s) => s.addLevel);
  const updateLevel = useFloorplanStore((s) => s.updateLevel);
  const removeLevel = useFloorplanStore((s) => s.removeLevel);
  const setActiveLevel = useFloorplanStore((s) => s.setActiveLevel);
  const setLevelViewMode = useFloorplanStore((s) => s.setLevelViewMode);
  const setShowGhostBelow2D = useFloorplanStore((s) => s.setShowGhostBelow2D);

  const [copyExteriorWalls, setCopyExteriorWalls] = useState(true);
  const [manualExpanded, setManualExpanded] = useState(false);
  const idLevelName = React.useId();
  const idCeilingHeight = React.useId();
  const idSlabThickness = React.useId();
  const idViewMode = React.useId();
  const showDetails = levels.length > 1 || manualExpanded;

  const activeLevel =
    levels.find((l) => l.id === activeLevelId) ?? levels[0] ?? null;

  const sortedTopDown = [...levels].sort((a, b) => b.index - a.index);

  const handleAddLevel = (direction: 'above' | 'below') => {
    const indices = levels.map((l) => l.index);
    const nextIndex =
      direction === 'above'
        ? (indices.length > 0 ? Math.max(...indices) : 0) + 1
        : (indices.length > 0 ? Math.min(...indices) : 0) - 1;
    const defaultName =
      direction === 'above'
        ? t('levels.defaultNameAbove', { index: nextIndex })
        : t('levels.defaultNameBelow', { index: Math.abs(nextIndex) });
    addLevel({
      name: defaultName,
      direction,
      copyFromLevelId: copyExteriorWalls ? activeLevelId : undefined,
    });
  };

  return (
    <section
      className="sidebar-section level-manager-section"
      data-testid="level-manager-section"
    >
      <div className="sidebar-title">
        <span>{t('levels.title')}</span>
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: '2px 6px', fontSize: '0.7rem' }}
          onClick={() => setManualExpanded((prev) => !prev)}
          aria-label={t('levels.title')}
        >
          <Layers size={12} />
        </button>
      </div>

      {/* Stacked level tabs (top down like a building section) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {sortedTopDown.map((lvl) => {
          const isActive = lvl.id === activeLevelId;
          return (
            <div
              key={lvl.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <button
                type="button"
                className={`btn ${isActive ? 'active' : 'btn-outline'}`}
                style={{
                  flex: 1,
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  fontSize: '0.78rem',
                }}
                onClick={() => setActiveLevel(lvl.id)}
              >
                <span style={{ fontWeight: isActive ? 700 : 500 }}>
                  {lvl.name}
                </span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                  {lvl.elevationCm >= 0 ? `+${lvl.elevationCm}` : lvl.elevationCm} cm
                </span>
              </button>
              {levels.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  title={t('levels.deleteLevel')}
                  style={{ padding: '5px 6px' }}
                  onClick={() => removeLevel(lvl.id)}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add level controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ flex: 1, fontSize: '0.74rem', padding: '4px 6px' }}
          onClick={() => handleAddLevel('above')}
        >
          <Plus size={12} />
          <span>{t('levels.addAbove')}</span>
        </button>
        <button
          type="button"
          className="btn btn-outline"
          style={{ flex: 1, fontSize: '0.74rem', padding: '4px 6px' }}
          onClick={() => handleAddLevel('below')}
        >
          <Plus size={12} />
          <span>{t('levels.addBelow')}</span>
        </button>
      </div>

      {showDetails && (
        <>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.74rem',
              color: '#cbd5e1',
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={copyExteriorWalls}
              onChange={(e) => setCopyExteriorWalls(e.target.checked)}
            />
            <span>{t('levels.copyWallsLabel')}</span>
          </label>

          {/* Active level properties */}
          {activeLevel && (
            <div className="form-grid" style={{ marginBottom: 8 }}>
              <div className="form-field full">
                <label htmlFor={idLevelName} className="form-label">{t('levels.nameLabel')}</label>
                <input
                  id={idLevelName}
                  type="text"
                  className="text-input"
                  value={activeLevel.name}
                  onChange={(e) =>
                    updateLevel(activeLevel.id, { name: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor={idCeilingHeight} className="form-label">{t('levels.ceilingHeightCm')}</label>
                <input
                  id={idCeilingHeight}
                  type="number"
                  min={150}
                  max={600}
                  step={5}
                  className="number-input"
                  value={activeLevel.ceilingHeightCm}
                  onChange={(e) =>
                    updateLevel(activeLevel.id, {
                      ceilingHeightCm: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="form-field">
                <label htmlFor={idSlabThickness} className="form-label">{t('levels.slabThicknessCm')}</label>
                <input
                  id={idSlabThickness}
                  type="number"
                  min={5}
                  max={100}
                  step={1}
                  className="number-input"
                  value={activeLevel.slabThicknessCm}
                  onChange={(e) =>
                    updateLevel(activeLevel.id, {
                      slabThicknessCm: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          )}

          {/* 2D ghost & 3D view mode */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.74rem',
              color: '#cbd5e1',
              marginBottom: 6,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showGhostBelow2D}
              onChange={(e) => setShowGhostBelow2D(e.target.checked)}
            />
            <span>{t('levels.ghostBelow2D')}</span>
          </label>

          <div className="form-field full">
            <label htmlFor={idViewMode} className="form-label">{t('levels.viewModeLabel')}</label>
            <select
              id={idViewMode}
              className="text-input"
              value={levelViewMode}
              onChange={(e) => setLevelViewMode(e.target.value as LevelViewMode)}
            >
              <option value="all-stacked">{t('levels.viewAllStacked')}</option>
              <option value="active-only">{t('levels.viewActiveOnly')}</option>
              <option value="ghost-below">{t('levels.viewGhostBelow')}</option>
            </select>
          </div>
        </>
      )}
    </section>
  );
};
