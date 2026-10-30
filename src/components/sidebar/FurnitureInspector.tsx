import React from 'react';
import { Trash2, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import type { FurnitureItem } from '../../core/types';
import { isFurnitureVisualType, resolveFurnitureVisual } from '../../core/furnitureVisual';
import { FURNITURE_VISUAL_OPTIONS } from '../../core/furnitureVisualCatalog';
import {
  OSAKA_POSES,
  MASTERLIFT_HEIGHT,
  clampMasterliftHeightCm,
  FurniturePose,
} from '../../core/knownFurniture';
import {
  computeFurnitureClearanceCm,
  computeFurnitureToWallDistanceCm,
} from '../../core/measureMath';

export function FurnitureInspector({
  selectedFurniture,
}: {
  selectedFurniture: FurnitureItem;
}) {
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const furniture = useFloorplanStore((s) => s.furniture);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const updateFurniture = useFloorplanStore((s) => s.updateFurniture);
  const removeFurniture = useFloorplanStore((s) => s.removeFurniture);
  const toggleFurnitureRealStatus = useFloorplanStore((s) => s.toggleFurnitureRealStatus);
  const resetFurnitureToCatalogDimensions = useFloorplanStore(
    (s) => s.resetFurnitureToCatalogDimensions
  );

        const report = collisionReports[selectedFurniture.id];
        const hasCollision = report?.hasCollision ?? false;

        const effectiveVisual =
          selectedFurniture.visual ?? resolveFurnitureVisual(selectedFurniture);

        const hasCatalogDims =
          selectedFurniture.catalogWidthCm !== undefined &&
          selectedFurniture.catalogHeightCm !== undefined &&
          selectedFurniture.catalogDepthCm !== undefined;
        const hasCatalogDeviation =
          hasCatalogDims &&
          (Math.abs(selectedFurniture.widthCm - selectedFurniture.catalogWidthCm!) > 0.05 ||
            Math.abs(selectedFurniture.heightCm - selectedFurniture.catalogHeightCm!) > 0.05 ||
            Math.abs(selectedFurniture.depthCm - selectedFurniture.catalogDepthCm!) > 0.05);

        return (
          <section className="sidebar-section">
            <div className="sidebar-title">
              <span>Möbel-Inspektor (cm)</span>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removeFurniture(selectedFurniture.id)}
              >
                <Trash2 size={13} />
                <span>Entfernen</span>
              </button>
            </div>

            {/* Furniture Inventory Status Badge & Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '2px 0',
              }}
            >
              <div
                style={{
                  background: selectedFurniture.isRealFurniture
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(148, 163, 184, 0.12)',
                  color: selectedFurniture.isRealFurniture ? '#34d399' : '#cbd5e1',
                  border: `1px solid ${
                    selectedFurniture.isRealFurniture
                      ? 'rgba(16, 185, 129, 0.35)'
                      : 'rgba(148, 163, 184, 0.3)'
                  }`,
                  fontSize: '0.74rem',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>{selectedFurniture.isRealFurniture ? '🟢' : '⚪'}</span>
                <span>
                  {selectedFurniture.isRealFurniture
                    ? 'Echtes Möbel (Inventar)'
                    : 'Platzhalter'}
                </span>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                userSelect: 'none',
                color: '#e2e8f0',
                padding: '2px 0 6px 0',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(selectedFurniture.isRealFurniture)}
                onChange={() => toggleFurnitureRealStatus(selectedFurniture.id)}
                style={{ cursor: 'pointer', accentColor: '#6366f1' }}
              />
              <span>Als echtes Möbelstück (Inventar) markieren</span>
            </label>

            {selectedFurniture.isRealFurniture && (
              <div className="form-grid" style={{ marginBottom: '4px' }}>
                <div className="form-field">
                  <label className="form-label">Marke / Hersteller</label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="z.B. BoConcept, Vitsœ"
                    value={selectedFurniture.brand ?? ''}
                    onChange={(e) =>
                      updateFurniture(selectedFurniture.id, {
                        brand: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Modell</label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="z.B. Osaka, 606"
                    value={selectedFurniture.modelName ?? ''}
                    onChange={(e) =>
                      updateFurniture(selectedFurniture.id, {
                        modelName: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div className="form-grid">
              <div className="form-field full">
                <label className="form-label">Bezeichnung</label>
                <input
                  type="text"
                  className="text-input"
                  value={selectedFurniture.name}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-field full">
                <label className="form-label">3D-Modell-Darstellung</label>
                <select
                  className="select-input"
                  value={selectedFurniture.visual ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateFurniture(selectedFurniture.id, {
                      visual: isFurnitureVisualType(value) ? value : undefined,
                    });
                  }}
                >
                  <option value="">Auto (Katalog / Kategorie)</option>
                  {FURNITURE_VISUAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="form-label">Breite (cm)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="number-input"
                  value={selectedFurniture.widthCm}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      widthCm: Number(e.target.value),
                    })
                  }
                />
              </div>

              {effectiveVisual === 'boconcept-osaka' && (
                <div className="form-field full">
                  <label className="form-label">Osaka</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['closed', 'open'] as FurniturePose[]).map((pose) => {
                      const active = (selectedFurniture.pose ?? 'closed') === pose;
                      return (
                        <button
                          key={pose}
                          type="button"
                          className={`btn ${active ? 'active' : ''}`}
                          aria-pressed={active}
                          onClick={() => {
                            const spec = OSAKA_POSES[pose];
                            updateFurniture(selectedFurniture.id, {
                              pose,
                              widthCm: spec.widthCm,
                              heightCm: spec.heightCm,
                              depthCm: spec.depthCm,
                              catalogWidthCm: spec.widthCm,
                              catalogHeightCm: spec.heightCm,
                              catalogDepthCm: spec.depthCm,
                            });
                          }}
                        >
                          {pose === 'closed' ? 'zugeklappt' : 'ausgeklappt'}
                        </button>
                      );
                    })}
                  </div>
                  {(selectedFurniture.pose ?? 'closed') === 'open' && (
                    <p className="form-label" style={{ marginTop: '6px' }}>
                      Ausgeklappte Höhe ist nicht gemessen. Angezeigt bleibt die zugeklappte Höhe 90 cm.
                    </p>
                  )}
                </div>
              )}

              {effectiveVisual === 'inwerk-masterlift' && (
                <div className="form-field full">
                  <label className="form-label">
                    Sitzhöhe Masterlift ({MASTERLIFT_HEIGHT.minCm}–{MASTERLIFT_HEIGHT.maxCm} cm)
                  </label>
                  <input
                    type="range"
                    min={MASTERLIFT_HEIGHT.minCm}
                    max={MASTERLIFT_HEIGHT.maxCm}
                    step={0.5}
                    value={clampMasterliftHeightCm(selectedFurniture.heightCm)}
                    onChange={(e) =>
                      updateFurniture(selectedFurniture.id, {
                        heightCm: clampMasterliftHeightCm(Number(e.target.value)),
                      })
                    }
                  />
                  {(selectedFurniture.heightCm < MASTERLIFT_HEIGHT.minCm ||
                    selectedFurniture.heightCm > MASTERLIFT_HEIGHT.maxCm) && (
                    <p className="form-label">
                      Die Höhe liegt außerhalb des Herstellerbereichs.
                    </p>
                  )}
                </div>
              )}

              <div className="form-field">
                <label className="form-label">Höhe (cm)</label>
                <input
                  type="number"
                  min={effectiveVisual === 'inwerk-masterlift' ? MASTERLIFT_HEIGHT.minCm : 1}
                  max={effectiveVisual === 'inwerk-masterlift' ? MASTERLIFT_HEIGHT.maxCm : undefined}
                  step={effectiveVisual === 'inwerk-masterlift' ? 0.5 : 1}
                  className="number-input"
                  value={selectedFurniture.heightCm}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const heightCm =
                      effectiveVisual === 'inwerk-masterlift'
                        ? clampMasterliftHeightCm(raw)
                        : raw;
                    updateFurniture(selectedFurniture.id, { heightCm });
                  }}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Tiefe (cm)</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="number-input"
                  value={selectedFurniture.depthCm}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      depthCm: Number(e.target.value),
                    })
                  }
                />
              </div>

              {hasCatalogDeviation && (
                <div
                  className="form-field full"
                  style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.74rem',
                      color: '#fef08a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      ⚠️ Maße weichen vom Katalog ab ({selectedFurniture.catalogWidthCm} ×{' '}
                      {selectedFurniture.catalogHeightCm} × {selectedFurniture.catalogDepthCm} cm)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.72rem', padding: '4px 8px', alignSelf: 'flex-start' }}
                    onClick={() => resetFurnitureToCatalogDimensions(selectedFurniture.id)}
                  >
                    Auf Katalogmaße zurücksetzen
                  </button>
                </div>
              )}

              <div className="form-field">
                <label className="form-label">Höhe ab Boden (cm)</label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  className="number-input"
                  value={selectedFurniture.elevationCm}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      elevationCm: Number(e.target.value),
                    })
                  }
                />
                {(effectiveVisual === 'wall-picture' ||
                  effectiveVisual === 'picture-rail') && (
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
                    Die Zahl ist die Unterkante. Seitlich schieben geht im Plan.
                  </div>
                )}
              </div>

              <div className="form-field">
                <label className="form-label">Pos X (cm)</label>
                <input
                  type="number"
                  step={5}
                  className="number-input"
                  value={selectedFurniture.x}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      x: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="form-field">
                <label className="form-label">Pos Z (cm)</label>
                <input
                  type="number"
                  step={5}
                  className="number-input"
                  value={selectedFurniture.z}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      z: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="form-field">
                <label className="form-label">Rotation (°)</label>
                <input
                  type="number"
                  step={15}
                  className="number-input"
                  value={selectedFurniture.rotationYDeg}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      rotationYDeg: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="form-field">
                <label className="form-label">Farbe</label>
                <input
                  type="color"
                  className="number-input"
                  style={{ height: '31px', padding: '2px 4px' }}
                  value={selectedFurniture.color}
                  onChange={(e) =>
                    updateFurniture(selectedFurniture.id, {
                      color: e.target.value,
                    })
                  }
                />
              </div>

              {/* Auszugszonen-Steuerung */}
              {(selectedFurniture.clearanceZoneCm !== undefined ||
                effectiveVisual === 'wardrobe' ||
                effectiveVisual === 'kitchen-unit' ||
                effectiveVisual === 'kitchen-island' ||
                effectiveVisual === 'generic-storage') && (
                <>
                  <div className="form-field">
                    <label className="form-label">Auszugszone / Türfreiraum (cm)</label>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      className="number-input"
                      value={selectedFurniture.clearanceZoneCm ?? 0}
                      onChange={(e) =>
                        updateFurniture(selectedFurniture.id, {
                          clearanceZoneCm: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  <div className="form-field full">
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: '#e2e8f0',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={(selectedFurniture.clearanceZoneCm ?? 0) > 0}
                        onChange={(e) =>
                          updateFurniture(selectedFurniture.id, {
                            clearanceZoneCm: e.target.checked ? 50 : 0,
                          })
                        }
                        style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                      />
                      <span>Auszugszone vor Front prüfen</span>
                    </label>
                  </div>
                </>
              )}

              {/* Bett Nachttisch-Option */}
              {(effectiveVisual === 'bed' ||
                (!selectedFurniture.visual && selectedFurniture.category === 'bedroom' && selectedFurniture.widthCm >= 190)) && (
                <div className="form-field full">
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                      color: '#e2e8f0',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selectedFurniture.hasNightstands === true ||
                        (selectedFurniture.hasNightstands !== false && selectedFurniture.widthCm >= 190)
                      }
                      onChange={(e) =>
                        updateFurniture(selectedFurniture.id, {
                          hasNightstands: e.target.checked,
                        })
                      }
                      style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                    />
                    <span>Schwebende Nachttische anzeigen &amp; prüfen (±30 cm)</span>
                  </label>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() =>
                  updateFurniture(selectedFurniture.id, {
                    rotationYDeg: (selectedFurniture.rotationYDeg + 45) % 360,
                  })
                }
              >
                <RotateCw size={13} />
                <span>+45° drehen</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() =>
                  updateFurniture(selectedFurniture.id, {
                    rotationYDeg: (selectedFurniture.rotationYDeg + 90) % 360,
                  })
                }
              >
                <RotateCw size={13} />
                <span>+90° drehen</span>
              </button>
            </div>

            {/* Live Collision & Wall Fit Diagnostic Box */}
            <div
              className={`diagnostic-box ${hasCollision ? 'error' : 'ok'}`}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                }}
              >
                {hasCollision ? (
                  <>
                    <AlertTriangle size={15} />
                    <span>Kollisions- &amp; Maßkonflikt erkannt!</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Passt konfliktfrei an Position</span>
                  </>
                )}
              </div>

              {report &&
                report.clearancesCm.leftCm !== null &&
                report.clearancesCm.rightCm !== null && (
                  <div style={{ fontSize: '0.74rem', opacity: 0.95 }}>
                    Wand-Restabstand Links: <b>{report.clearancesCm.leftCm} cm</b>{' '}
                    | Rechts: <b>{report.clearancesCm.rightCm} cm</b>
                  </div>
                )}

              {hasCollision &&
                report?.issues.map((issue, idx) => (
                  <div key={idx} style={{ fontSize: '0.75rem' }}>
                    • {issue.message}
                  </div>
                ))}
            </div>

            {/* Lichte Abstände & Durchgänge */}
            {(() => {
              const otherClearances = furniture
                .filter((f) => f.id !== selectedFurniture.id)
                .map((other) => ({
                  other,
                  ...computeFurnitureClearanceCm(selectedFurniture, other),
                }))
                .sort((a, b) => a.clearanceCm - b.clearanceCm)
                .slice(0, 3);

              const wallDistances = walls
                .map((w) => ({
                  wall: w,
                  distanceCm: computeFurnitureToWallDistanceCm(selectedFurniture, w, corners),
                }))
                .sort((a, b) => a.distanceCm - b.distanceCm)
                .slice(0, 2);

              return (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    fontSize: '0.74rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>📏 Lichte Durchgänge &amp; Abstände</span>
                  </div>
                  {otherClearances.length === 0 && wallDistances.length === 0 && (
                    <div style={{ color: '#94a3b8' }}>Keine weiteren Objekte im Raum.</div>
                  )}
                  {otherClearances.map(({ other, clearanceCm, isOverlapping }) => (
                    <div key={other.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        zu {other.name}:
                      </span>
                      <b style={{ color: isOverlapping ? '#ef4444' : clearanceCm < 60 ? '#f59e0b' : '#34d399' }}>
                        {isOverlapping ? 'Kollision (0 cm)' : `${clearanceCm} cm`}
                      </b>
                    </div>
                  ))}
                  {wallDistances.map(({ wall, distanceCm }) => (
                    <div key={wall.id} style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                      <span>zu Wand ({wall.id}):</span>
                      <b style={{ color: '#cbd5e1' }}>{distanceCm} cm</b>
                    </div>
                  ))}
                </div>
              );
            })()}
          </section>
        );
}
