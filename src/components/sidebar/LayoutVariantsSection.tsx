import React from 'react';
import { Layers, Plus, Trash2, Star, Eye, EyeOff } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  compareLayoutVariants,
  computeVariantDiff,
} from '../../core/layoutVariants';

export const LayoutVariantsSection: React.FC = () => {
  const { t } = useTranslation();
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const roofSlopes = useFloorplanStore((s) => s.roofSlopes);
  const fixtures = useFloorplanStore((s) => s.fixtures);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs = useFloorplanStore((s) => s.rugs);
  const layoutVariants = useFloorplanStore((s) => s.layoutVariants);
  const activeVariantId = useFloorplanStore((s) => s.activeVariantId);
  const ghostVariantId = useFloorplanStore((s) => s.ghostVariantId);
  const saveLayoutVariant = useFloorplanStore((s) => s.saveLayoutVariant);
  const switchLayoutVariant = useFloorplanStore((s) => s.switchLayoutVariant);
  const setGhostVariantId = useFloorplanStore((s) => s.setGhostVariantId);
  const deleteLayoutVariant = useFloorplanStore((s) => s.deleteLayoutVariant);

  const [draftName, setDraftName] = React.useState('');

  const ghostDiff = React.useMemo(() => {
    if (!ghostVariantId) return null;
    const ghost = layoutVariants.find((v) => v.id === ghostVariantId);
    if (!ghost) return null;
    return computeVariantDiff({ furniture, rugs }, ghost);
  }, [ghostVariantId, layoutVariants, furniture, rugs]);

  const comparison = React.useMemo(() => {
    if (layoutVariants.length === 0) return null;
    // Use live furniture & rugs for the active variant so metrics reflect unsaved edits live
    const effectiveVariants = layoutVariants.map((v) =>
      v.id === activeVariantId ? { ...v, furniture, rugs } : v
    );
    return compareLayoutVariants(
      { corners, walls, openings, roomLabels, roofSlopes, fixtures },
      effectiveVariants
    );
  }, [
    layoutVariants,
    activeVariantId,
    furniture,
    rugs,
    corners,
    walls,
    openings,
    roomLabels,
    roofSlopes,
    fixtures,
  ]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveLayoutVariant(draftName.trim() || undefined);
    setDraftName('');
  };

  return (
    <section className="sidebar-section" data-testid="layout-variants-section">
      <div className="sidebar-title">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} />
          <span>{t('inspector.variants.title')}</span>
        </span>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input
          type="text"
          className="text-input"
          placeholder={t('inspector.variants.namePlaceholder')}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          style={{ flex: 1, fontSize: '0.74rem' }}
        />
        <button
          type="submit"
          className="btn btn-outline"
          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
        >
          <Plus size={12} />
          <span>{t('inspector.variants.save')}</span>
        </button>
      </form>

      {comparison && comparison.metrics.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {comparison.metrics.map((m) => {
            const isActive = m.variantId === activeVariantId;
            const isGhost = m.variantId === ghostVariantId;
            const isBest =
              comparison.metrics.length > 1 && m.variantId === comparison.recommendedVariantId;
            return (
              <div
                key={m.variantId}
                data-testid={`variant-card-${m.variantId}`}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: isActive
                    ? 'rgba(56, 189, 248, 0.14)'
                    : isGhost
                    ? 'rgba(168, 85, 247, 0.14)'
                    : 'rgba(30, 41, 59, 0.5)',
                  border: `1px solid ${
                    isActive
                      ? '#38bdf8'
                      : isGhost
                      ? '#a855f7'
                      : 'rgba(71, 85, 105, 0.4)'
                  }`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => switchLayoutVariant(m.variantId)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      flex: 1,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: isActive ? '#38bdf8' : isGhost ? '#d8b4fe' : '#f8fafc',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{m.name}</span>
                    {isBest && (
                      <Star size={11} color="#fbbf24" fill="#fbbf24" />
                    )}
                  </button>
                  {!isActive && (
                    <button
                      type="button"
                      className={`btn btn-outline${isGhost ? ' active' : ''}`}
                      data-testid={`variant-ghost-toggle-${m.variantId}`}
                      aria-pressed={isGhost}
                      style={{ padding: '2px 5px' }}
                      onClick={() =>
                        setGhostVariantId(isGhost ? null : m.variantId)
                      }
                      title={
                        isGhost
                          ? t('inspector.variants.hideGhost')
                          : t('inspector.variants.showGhost')
                      }
                    >
                      {isGhost ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '2px 5px' }}
                    onClick={() => deleteLayoutVariant(m.variantId)}
                    title={t('inspector.variants.delete')}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div
                  style={{
                    fontSize: '0.67rem',
                    color: '#cbd5e1',
                    marginTop: '3px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  <span>{t('inspector.variants.freePercent', { pct: m.freeFloorPercent })}</span>
                  <span>·</span>
                  <span>{t('inspector.variants.criticalCount', { count: m.criticalPassages })}</span>
                  <span>·</span>
                  <span>{t('inspector.variants.collisionsCount', { count: m.collisionCount })}</span>
                  <span>·</span>
                  <span>
                    {m.overallScore} ({m.overallGrade})
                  </span>
                </div>
              </div>
            );
          })}
          {ghostDiff && (
            <div
              data-testid="variant-ghost-diff-summary"
              style={{
                fontSize: '0.7rem',
                color: '#d8b4fe',
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                borderRadius: '6px',
                padding: '4px 8px',
              }}
            >
              {t('inspector.variants.diffSummary', {
                added: ghostDiff.ghostOnlyFurniture.length,
                removed: ghostDiff.activeOnlyFurniture.length,
                moved: ghostDiff.movedFurniture.length,
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
