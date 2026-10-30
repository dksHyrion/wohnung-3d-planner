import React, { useState, useMemo } from 'react';
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  PackagePlus,
  Trash2,
  Link2,
} from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { WallInspector } from './WallInspector';
import { OpeningInspector } from './OpeningInspector';
import { FurnitureInspector } from './FurnitureInspector';
import { RoomInspector } from './RoomInspector';
import { RugInspector } from './RugInspector';
import { CatalogFurnitureTemplate, FURNITURE_CATALOG } from '../../core/presets';
import { FurnitureItem } from '../../core/types';
import { applyRoomLabels, computeFloorPolygons } from '../../core/wallMath';

export type CatalogFilterTab = 'all' | 'real' | 'placeholder';

export function filterCatalogTemplates(
  catalog: CatalogFurnitureTemplate[],
  filter: CatalogFilterTab
): CatalogFurnitureTemplate[] {
  if (filter === 'real') {
    return catalog.filter((tpl) => Boolean(tpl.isRealFurniture));
  }
  if (filter === 'placeholder') {
    return catalog.filter((tpl) => !tpl.isRealFurniture);
  }
  return catalog;
}

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
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const openings = useFloorplanStore((s) => s.openings);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs = useFloorplanStore((s) => s.rugs);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);

  const moveCorner = useFloorplanStore((s) => s.moveCorner);
  const removeWall = useFloorplanStore((s) => s.removeWall);
  const removeCorner = useFloorplanStore((s) => s.removeCorner);
  const addFurniture = useFloorplanStore((s) => s.addFurniture);
  const updateFurniture = useFloorplanStore((s) => s.updateFurniture);
  const addRug = useFloorplanStore((s) => s.addRug);
  const selectEntity = useFloorplanStore((s) => s.selectEntity);

  const computedRooms = useMemo(
    () => applyRoomLabels(computeFloorPolygons(corners, walls), roomLabels),
    [corners, walls, roomLabels]
  );

  // Catalog tab filter state
  const [catalogFilter, setCatalogFilter] =
    useState<CatalogFilterTab>(initialCatalogFilter);

  const filteredCatalog = useMemo(
    () => filterCatalogTemplates(catalog, catalogFilter),
    [catalog, catalogFilter]
  );

  // Custom furniture generator state
  const [customName, setCustomName] = useState('Eigenes Möbelstück');
  const [customWidthCm, setCustomWidthCm] = useState(180);
  const [customHeightCm, setCustomHeightCm] = useState(85);
  const [customDepthCm, setCustomDepthCm] = useState(60);
  const [customColor, setCustomColor] = useState('#6366f1');

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

  const selectedFurniture =
    propSelectedFurniture !== undefined
      ? propSelectedFurniture
      : selectedType === 'furniture'
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

  const attachedChildren = useMemo(
    () =>
      selectedFurniture
        ? furniture.filter((f) => f.attachedToId === selectedFurniture.id)
        : [],
    [furniture, selectedFurniture]
  );

  const candidateParents = useMemo(() => {
    if (!selectedFurniture) return [];
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
    return furniture.filter((f) => !descendants.has(f.id));
  }, [furniture, selectedFurniture]);

  const getRoomCenter = () => {
    if (corners.length === 0) return { x: 200, z: 200 };
    const sumX = corners.reduce((acc, c) => acc + c.x, 0);
    const sumZ = corners.reduce((acc, c) => acc + c.z, 0);
    return {
      x: Math.round(sumX / corners.length),
      z: Math.round(sumZ / corners.length),
    };
  };

  const handleAddCatalogItem = (template: (typeof FURNITURE_CATALOG)[number]) => {
    const center = getRoomCenter();
    addFurniture({
      ...template,
      x: center.x,
      z: center.z,
      rotationYDeg: 0,
      snappedWallId: null,
    });
  };

  const handleAddCustomFurniture = (e: React.FormEvent) => {
    e.preventDefault();
    const center = getRoomCenter();
    addFurniture({
      name: customName.trim() || 'Wunschmöbel',
      category: 'custom',
      widthCm: Math.max(1, Number(customWidthCm)),
      heightCm: Math.max(1, Number(customHeightCm)),
      depthCm: Math.max(1, Number(customDepthCm)),
      elevationCm: 0,
      x: center.x,
      z: center.z,
      rotationYDeg: 0,
      color: customColor,
      snappedWallId: null,
    });
  };

  return (
    <aside className="sidebar">
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
              <span>Wand entfernen</span>
            </button>
          </section>
        </>
      )}

      {/* 2. Selected Corner Inspector */}
      {selectedCorner && (
        <section className="sidebar-section">
          <div className="sidebar-title">
            <span>Wandecke ({selectedCorner.id})</span>
            <Sliders size={14} />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label">Position X (cm)</label>
              <input
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
              <label className="form-label">Position Z (cm)</label>
              <input
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
                <span>Wandecke entfernen</span>
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

      {/* 5. Selected Furniture Inspector + Surface Stacking */}
      {selectedFurniture && (
        <>
          <FurnitureInspector selectedFurniture={selectedFurniture} />
          <section
            className="sidebar-section"
            data-testid="surface-stacking-section"
          >
            <div className="sidebar-title">
              <span>Objekt-Kopplung (Trägerfläche)</span>
              <Link2 size={14} />
            </div>
            <div className="form-grid">
              <div className="form-field full">
                <label className="form-label" htmlFor="attached-to-select">
                  Steht auf / Gekoppelt mit
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
                  <option value="">— Frei im Raum (keine Kopplung) —</option>
                  {candidateParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (H {p.heightCm} cm)
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
                    🔗 <b>Gekoppelte Objekte ({attachedChildren.length}):</b>{' '}
                    {attachedChildren.map((c) => c.name).join(', ')} wandern bei
                    Verschiebung, Drehung und Höhenänderung automatisch mit.
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
            <span>Auswahl-Hinweis</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
            Klicke im 2D-Grundriss oder in der 3D-Ansicht auf eine{' '}
            <b>Wand</b>, <b>Tür/Fenster</b> oder ein <b>Möbelstück</b>, um die
            exakten Zentimeter-Maße zu bearbeiten.
          </p>
        </section>
      )}

      {/* 5. Standard Furniture Catalog (DIN / Neufert & Designer Inventory) */}
      <section className="sidebar-section">
        <div className="sidebar-title">
          <span>Möbel-Katalog (cm)</span>
          <Plus size={14} />
        </div>

        {/* Tab Filter Switcher */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-app)',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={catalogFilter === 'all'}
            className={`btn ${catalogFilter === 'all' ? 'active' : ''}`}
            style={{ flex: 1, padding: '4px 6px', fontSize: '0.72rem' }}
            onClick={() => setCatalogFilter('all')}
          >
            Alle
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={catalogFilter === 'real'}
            className={`btn ${catalogFilter === 'real' ? 'active' : ''}`}
            style={{ flex: 1.6, padding: '4px 6px', fontSize: '0.72rem' }}
            onClick={() => setCatalogFilter('real')}
          >
            Mein Inventar (Echte Möbel)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={catalogFilter === 'placeholder'}
            className={`btn ${catalogFilter === 'placeholder' ? 'active' : ''}`}
            style={{ flex: 1, padding: '4px 6px', fontSize: '0.72rem' }}
            onClick={() => setCatalogFilter('placeholder')}
          >
            Platzhalter
          </button>
        </div>

        <div className="catalog-grid">
          {filteredCatalog.length === 0 ? (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                padding: '8px 4px',
                textAlign: 'center',
              }}
            >
              Keine Einträge in dieser Kategorie.
            </div>
          ) : (
            filteredCatalog.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                className="catalog-item-btn"
                onClick={() => handleAddCatalogItem(tpl)}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {tpl.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: tpl.isRealFurniture
                          ? 'rgba(16, 185, 129, 0.16)'
                          : 'rgba(148, 163, 184, 0.12)',
                        color: tpl.isRealFurniture ? '#34d399' : '#94a3b8',
                        border: `1px solid ${
                          tpl.isRealFurniture
                            ? 'rgba(16, 185, 129, 0.35)'
                            : 'rgba(148, 163, 184, 0.25)'
                        }`,
                        fontWeight: 600,
                      }}
                    >
                      {tpl.isRealFurniture
                        ? tpl.brand
                          ? `🟢 ${tpl.brand} · Echtes Möbel`
                          : '🟢 Echtes Möbel'
                        : '⚪ Platzhalter'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {tpl.widthCm} × {tpl.heightCm} × {tpl.depthCm} cm (B×H×T)
                  </div>
                </div>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: tpl.color,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
              </button>
            ))
          )}
        </div>
      </section>

      {/* 6. Custom Furniture Generator ("Eigenes Wunschmöbel nach Maß") */}
      <section className="sidebar-section">
        <div className="sidebar-title">
          <span>Eigenes Wunschmöbel (cm)</span>
          <PackagePlus size={14} />
        </div>
        <form onSubmit={handleAddCustomFurniture} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Name</label>
            <input
              type="text"
              className="text-input"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Breite (cm)</label>
            <input
              type="number"
              min={1}
              className="number-input"
              value={customWidthCm}
              onChange={(e) => setCustomWidthCm(Number(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Höhe (cm)</label>
            <input
              type="number"
              min={1}
              className="number-input"
              value={customHeightCm}
              onChange={(e) => setCustomHeightCm(Number(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Tiefe (cm)</label>
            <input
              type="number"
              min={1}
              className="number-input"
              value={customDepthCm}
              onChange={(e) => setCustomDepthCm(Number(e.target.value))}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Farbe</label>
            <input
              type="color"
              className="number-input"
              style={{ height: '31px', padding: '2px 4px' }}
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
            />
          </div>
          <div className="form-field full">
            <button
              type="submit"
              className="btn active"
              style={{ width: '100%', padding: '8px' }}
            >
              <Plus size={14} />
              <span>Möbelstück in Raum einfügen</span>
            </button>
          </div>
        </form>
      </section>

      {/* Quick list of placed furniture with collision indicator */}
      {furniture.length > 0 && (
        <section className="sidebar-section">
          <div className="sidebar-title">
            <span>Platzierte Möbel ({furniture.length})</span>
          </div>
          <div className="catalog-grid">
            {furniture.map((f) => {
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
          <span>Teppiche & Textilzonen ({rugs.length})</span>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={() => {
              const center = getRoomCenter();
              addRug({
                name: `Teppich ${rugs.length + 1}`,
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
            <span>+ Teppich</span>
          </button>
        </div>
        {rugs.length > 0 && (
          <div className="catalog-grid">
            {rugs.map((r) => {
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
                      {r.name ?? 'Teppich'}
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
    </aside>
  );
};
