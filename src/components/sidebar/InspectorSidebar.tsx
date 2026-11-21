import React, { useMemo } from 'react';
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Trash2,
  Link2,
  RotateCw,
} from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { WallInspector } from './WallInspector';
import { OpeningInspector } from './OpeningInspector';
import { FurnitureInspector } from './FurnitureInspector';
import { RoomInspector } from './RoomInspector';
import { RugInspector } from './RugInspector';
import { FixtureInspector } from './FixtureInspector';
import { StairInspector } from './StairInspector';
import { LayoutVariantsSection } from './LayoutVariantsSection';
import { ErgonomicsScorecardSection } from './ErgonomicsScorecardSection';
import { LevelManagerSection } from './LevelManagerSection';
import {
  FurnitureCatalogSection,
  filterCatalogTemplates,
  type CatalogFilterTab,
} from './FurnitureCatalogSection';
import { CustomFurnitureFormSection } from './CustomFurnitureFormSection';
import { getEntityLevelId } from '../../core/levels';
import { useActiveLevelEntities } from '../../hooks/useActiveLevelEntities';
import {
  CatalogFurnitureTemplate,
  FURNITURE_CATALOG,
  getCatalogItemName,
} from '../../core/presets';
import { FurnitureItem } from '../../core/types';
import { applyRoomLabels, computeFloorPolygons } from '../../core/wallMath';
import { useTranslation } from '../../i18n/useTranslation';

export { filterCatalogTemplates };
export type { CatalogFilterTab };

export interface InspectorSidebarProps {
  initialCatalogFilter?: CatalogFilterTab;
  selectedFurniture?: FurnitureItem | null;
  catalog?: CatalogFurnitureTemplate[];
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  initialCatalogFilter = 'all',
  selectedFurniture: propSelectedFurniture,
  catalog = FURNITURE_CATALOG,
}) => {
  const { t, language } = useTranslation();
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const fixtures = useFloorplanStore((s) => s.fixtures);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs = useFloorplanStore((s) => s.rugs);
  const stairs = useFloorplanStore((s) => s.stairs);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedIds = useFloorplanStore((s) => s.selectedIds);
  const selectedType = useFloorplanStore((s) => s.selectedType);

  const moveCorner = useFloorplanStore((s) => s.moveCorner);
  const removeWall = useFloorplanStore((s) => s.removeWall);
  const removeCorner = useFloorplanStore((s) => s.removeCorner);
  const addFurniture = useFloorplanStore((s) => s.addFurniture);
  const updateFurniture = useFloorplanStore((s) => s.updateFurniture);
  const rotateSelectedFurniture = useFloorplanStore((s) => s.rotateSelectedFurniture);
  const removeSelectedFurniture = useFloorplanStore((s) => s.removeSelectedFurniture);
  const addRug = useFloorplanStore((s) => s.addRug);
  const addStair = useFloorplanStore((s) => s.addStair);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  const {
    corners: levelCorners,
    walls: levelWalls,
    roomLabels: levelRoomLabels,
    furniture: levelFurniture,
    rugs: levelRugs,
  } = useActiveLevelEntities();

  const computedRooms = useMemo(
    () => applyRoomLabels(computeFloorPolygons(levelCorners, levelWalls), levelRoomLabels),
    [levelCorners, levelWalls, levelRoomLabels]
  );

  const idCornerX = React.useId();
  const idCornerZ = React.useId();

  const selectedWall =
    selectedType === 'wall'
      ? walls.find((w) => w.id === selectedId) ?? null
      : null;

  const selectedCorner =
    selectedType === 'corner'
      ? corners.find((c) => c.id === selectedId) ?? null
      : null;

  const selectedOpening =
    selectedType === 'opening'
      ? openings.find((o) => o.id === selectedId) ?? null
      : null;

  const multiSelectedFurniture = useMemo(
    () =>
      selectedType === 'furniture' && selectedIds.length > 1
        ? furniture.filter((f) => selectedIds.includes(f.id))
        : [],
    [furniture, selectedIds, selectedType]
  );

  const selectedFurniture =
    propSelectedFurniture !== undefined
      ? propSelectedFurniture
      : selectedType === 'furniture' && selectedIds.length <= 1
      ? furniture.find((f) => f.id === selectedId) ?? null
      : null;

  const selectedRoomIndex =
    selectedType === 'room'
      ? computedRooms.findIndex((r) => r.id === selectedId)
      : -1;
  const selectedRoom =
    selectedRoomIndex >= 0 ? computedRooms[selectedRoomIndex] : null;

  const selectedRug =
    selectedType === 'rug'
      ? rugs.find((r) => r.id === selectedId) ?? null
      : null;

  const selectedStair =
    selectedType === 'stair'
      ? stairs.find((st) => st.id === selectedId) ?? null
      : null;

  const selectedFixture =
    selectedType === 'fixture'
      ? fixtures.find((fx) => fx.id === selectedId) ?? null
      : null;

  const attachedChildren = useMemo(
    () =>
      selectedFurniture
        ? furniture.filter((f) => f.attachedToId === selectedFurniture.id)
        : [],
    [furniture, selectedFurniture]
  );

  const candidateParents = useMemo(() => {
    if (!selectedFurniture) return [];
    const targetLevelId = getEntityLevelId(selectedFurniture);
    const descendants = new Set<string>([selectedFurniture.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of furniture) {
        if (
          item.attachedToId &&
          descendants.has(item.attachedToId) &&
          !descendants.has(item.id)
        ) {
          descendants.add(item.id);
          changed = true;
        }
      }
    }
    return furniture.filter(
      (f) => !descendants.has(f.id) && getEntityLevelId(f) === targetLevelId
    );
  }, [furniture, selectedFurniture]);

  const getRoomCenter = () => {
    if (levelCorners.length === 0) return { x: 200, z: 200 };
    const sumX = levelCorners.reduce((acc, c) => acc + c.x, 0);
    const sumZ = levelCorners.reduce((acc, c) => acc + c.z, 0);
    return {
      x: Math.round(sumX / levelCorners.length),
      z: Math.round(sumZ / levelCorners.length),
    };
  };

  const handleAddCatalogItem = (template: (typeof FURNITURE_CATALOG)[number]) => {
    const center = getRoomCenter();
    addFurniture({
      ...template,
      name: getCatalogItemName(template, language),
      x: center.x,
      z: center.z,
      rotationYDeg: 0,
      snappedWallId: null,
    });
  };

  const handleAddCustomFurniture = (item: {
    name: string;
    widthCm: number;
    heightCm: number;
    depthCm: number;
    color: string;
  }) => {
    const center = getRoomCenter();
    addFurniture({
      name: item.name,
      category: 'custom',
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      depthCm: item.depthCm,
      elevationCm: 0,
      x: center.x,
      z: center.z,
      rotationYDeg: 0,
      color: item.color,
      snappedWallId: null,
    });
  };

  return (
    <aside className="sidebar">
      <LevelManagerSection />

      {/* 1. Selected Wall Inspector */}
      {selectedWall && (
        <>
          <WallInspector selectedWall={selectedWall} />
          <section className="sidebar-section" style={{ paddingTop: 0 }}>
            <button
              type="button"
              className="btn btn-danger"
              style={{ width: '100%' }}
              onClick={() => removeWall(selectedWall.id)}
            >
              <Trash2 size={14} />
              <span>{t('inspector.wall.deleteWall')}</span>
            </button>
          </section>
        </>
      )}

      {/* 2. Selected Corner Inspector */}
      {selectedCorner && (
        <section className="sidebar-section">
          <div className="sidebar-title">
            <span>{t('inspector.corner.title', { id: selectedCorner.id })}</span>
            <Sliders size={14} />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor={idCornerX} className="form-label">{t('inspector.corner.posX')}</label>
              <input
                id={idCornerX}
                type="number"
                step={5}
                className="number-input"
                value={selectedCorner.x}
                onChange={(e) =>
                  moveCorner(
                    selectedCorner.id,
                    Number(e.target.value),
                    selectedCorner.z
                  )
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor={idCornerZ} className="form-label">{t('inspector.corner.posZ')}</label>
              <input
                id={idCornerZ}
                type="number"
                step={5}
                className="number-input"
                value={selectedCorner.z}
                onChange={(e) =>
                  moveCorner(
                    selectedCorner.id,
                    selectedCorner.x,
                    Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="form-field full">
              <button
                type="button"
                className="btn btn-danger"
                style={{ width: '100%' }}
                onClick={() => removeCorner(selectedCorner.id)}
              >
                <Trash2 size={14} />
                <span>{t('inspector.corner.deleteCorner')}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Selected Opening (Door / Window) Inspector */}
      {selectedOpening && <OpeningInspector selectedOpening={selectedOpening} />}

      {/* 4. Selected Room Inspector */}
      {selectedRoom && (
        <RoomInspector
          selectedRoom={selectedRoom}
          roomIndex={selectedRoomIndex}
        />
      )}

      {/* 4b. Selected Rug Inspector */}
      {selectedRug && <RugInspector selectedRug={selectedRug} />}

      {/* 4b2. Selected Staircase Inspector */}
      {selectedStair && <StairInspector selectedStair={selectedStair} />}

      {/* 4c. Selected Wall Fixture (MEP) Inspector */}
      {selectedFixture && <FixtureInspector selectedFixture={selectedFixture} />}

      {/* 5a. Multi-Selection Group Inspector */}
      {multiSelectedFurniture.length > 1 && (
        <section
          className="sidebar-section"
          data-testid="multi-select-inspector"
        >
          <div className="sidebar-title">
            <span>
              {t('inspector.multiSelect.title', {
                count: multiSelectedFurniture.length,
              })}
            </span>
            <RotateCw size={14} color="#38bdf8" />
          </div>
          <p style={{ fontSize: '0.78rem', color: '#e2e8f0', margin: '0 0 6px' }}>
            {t('inspector.multiSelect.summary', {
              count: multiSelectedFurniture.length,
            })}
          </p>
          <div
            style={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              marginBottom: '8px',
            }}
          >
            {multiSelectedFurniture.map((f) => f.name).join(' · ')}
          </div>
          <div className="form-grid">
            <div className="form-field full">
              <span className="form-label">
                {t('inspector.multiSelect.rotateGroup')}
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[-90, -15, 15, 90].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1, padding: '4px 6px', fontSize: '0.74rem' }}
                    onClick={() => rotateSelectedFurniture(selectedIds, deg)}
                  >
                    {deg > 0 ? `+${deg}°` : `${deg}°`}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field full" style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => selectEntity(null, null)}
              >
                {t('inspector.multiSelect.clearSelection')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => removeSelectedFurniture(selectedIds)}
              >
                <Trash2 size={14} />
                <span>
                  {t('inspector.multiSelect.deleteGroup', {
                    count: multiSelectedFurniture.length,
                  })}
                </span>
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '8px 0 0' }}>
            {t('inspector.multiSelect.hint')}
          </p>
        </section>
      )}

      {/* 5. Selected Furniture Inspector + Surface Stacking */}
      {selectedFurniture && (
        <>
          <FurnitureInspector selectedFurniture={selectedFurniture} />
          <section
            className="sidebar-section"
            data-testid="surface-stacking-section"
          >
            <div className="sidebar-title">
              <span>{t('inspector.stacking.title')}</span>
              <Link2 size={14} />
            </div>
            <div className="form-grid">
              <div className="form-field full">
                <label className="form-label" htmlFor="attached-to-select">
                  {t('inspector.stacking.attachedTo')}
                </label>
                <select
                  id="attached-to-select"
                  className="select-input"
                  value={selectedFurniture.attachedToId ?? ''}
                  onChange={(e) => {
                    const parentId = e.target.value ? e.target.value : null;
                    updateFurniture(selectedFurniture.id, {
                      attachedToId: parentId,
                    });
                  }}
                >
                  <option value="">{t('inspector.stacking.none')}</option>
                  {candidateParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({t('inspector.stacking.heightUnit', { height: p.heightCm })})
                    </option>
                  ))}
                </select>
              </div>
              {attachedChildren.length > 0 && (
                <div className="form-field full">
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: 6,
                      padding: '6px 8px',
                    }}
                  >
                    <b>
                      {t('inspector.stacking.attachedChildrenCount', {
                        count: attachedChildren.length,
                      })}
                    </b>{' '}
                    {attachedChildren.map((c) => c.name).join(', ')}{' '}
                    {t('inspector.stacking.attachedChildrenHint')}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Hint when nothing is selected */}
      {!selectedId && (
        <section className="sidebar-section">
          <div className="sidebar-title">
            <span>{t('inspector.selectionHintTitle')}</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
            {t('inspector.noSelectionHint')}
          </p>
        </section>
      )}

      {/* 5. Standard Furniture Catalog (DIN / Neufert & Designer Inventory) */}
      <FurnitureCatalogSection
        catalog={catalog}
        initialFilter={initialCatalogFilter}
        onAddTemplate={handleAddCatalogItem}
      />

      {/* 6. Custom Furniture Generator ("Eigenes Wunschmöbel nach Maß") */}
      <CustomFurnitureFormSection onAddCustom={handleAddCustomFurniture} />

      {/* Quick list of placed furniture with collision indicator */}
      {levelFurniture.length > 0 && (
        <section className="sidebar-section">
          <div className="sidebar-title">
            <span>{t('inspector.placedFurniture.title', { count: levelFurniture.length })}</span>
          </div>
          <div className="catalog-grid">
            {levelFurniture.map((f) => {
              const hasCol = collisionReports[f.id]?.hasCollision ?? false;
              const isSel = selectedType === 'furniture' && selectedId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  className="catalog-item-btn"
                  style={{
                    borderColor: hasCol
                      ? '#ef4444'
                      : isSel
                      ? '#6366f1'
                      : undefined,
                  }}
                  onClick={() => selectEntity(f.id, 'furniture')}
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      {f.widthCm}×{f.heightCm}×{f.depthCm} cm
                    </div>
                  </div>
                  {hasCol ? (
                    <AlertTriangle size={14} color="#ef4444" />
                  ) : (
                    <CheckCircle2 size={14} color="#10b981" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Rugs & Textile Zones Section */}
      <section className="sidebar-section">
        <div className="sidebar-title">
          <span>{t('inspector.placedRugs.title', { count: levelRugs.length })}</span>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={() => {
              const center = getRoomCenter();
              addRug({
                name: `${t('inspector.rug.defaultName')} ${levelRugs.length + 1}`,
                widthCm: 220,
                depthCm: 160,
                x: center.x,
                z: center.z,
                rotationYDeg: 0,
                color: '#edece8',
              });
            }}
          >
            <Plus size={12} />
            <span>{t('inspector.placedRugs.add')}</span>
          </button>
        </div>
        {levelRugs.length > 0 && (
          <div className="catalog-grid">
            {levelRugs.map((r) => {
              const isSel = selectedType === 'rug' && selectedId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  className="catalog-item-btn"
                  style={{
                    borderColor: isSel ? '#38bdf8' : undefined,
                  }}
                  onClick={() => selectEntity(r.id, 'rug')}
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      {r.name ?? t('inspector.rug.defaultName')}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      {r.widthCm} × {r.depthCm} cm
                    </div>
                  </div>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: r.color ?? '#edece8',
                      border: '1px solid #475569',
                      display: 'inline-block',
                    }}
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Stairs Section */}
      <section className="sidebar-section">
        <div className="sidebar-title">
          <span>{t('stairs.sectionTitle', { count: stairs.length })}</span>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={() => {
              const center = getRoomCenter();
              addStair({ x: center.x, z: center.z });
            }}
          >
            <Plus size={12} />
            <span>{t('stairs.add')}</span>
          </button>
        </div>
        {stairs.length > 0 && (
          <div className="catalog-grid">
            {stairs.map((st) => {
              const isSel = selectedType === 'stair' && selectedId === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  className="catalog-item-btn"
                  style={{ borderColor: isSel ? '#38bdf8' : undefined }}
                  onClick={() => selectEntity(st.id, 'stair')}
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      {st.type === 'straight'
                        ? t('stairs.typeStraight')
                        : st.type === 'l-shaped'
                        ? t('stairs.typeLShaped')
                        : t('stairs.typeUShaped')}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      {st.widthCm} cm · a={st.treadDepthCm} cm
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <LayoutVariantsSection />

      <ErgonomicsScorecardSection />
    </aside>
  );
};
