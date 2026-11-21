import React, { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { FlooringType, RoomPolygon } from '../../core/types';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { computeRoomWoFlVBreakdown, resolveRoofSlopePlanes } from '../../core/roofSlopeMath';
import { useActiveLevelEntities } from '../../hooks/useActiveLevelEntities';

export interface RoomInspectorProps {
  selectedRoom: RoomPolygon;
  roomIndex: number;
}

const FLOORING_OPTION_KEYS: {
  value: FlooringType;
  key: 'parquet' | 'microcement' | 'tile';
}[] = [
  { value: 'parquet', key: 'parquet' },
  { value: 'microcement', key: 'microcement' },
  { value: 'tile', key: 'tile' },
];

export const RoomInspector: React.FC<RoomInspectorProps> = ({
  selectedRoom,
  roomIndex,
}) => {
  const { t, language } = useTranslation();
  const updateRoom = useFloorplanStore((s) => s.updateRoom);
  const {
    corners: levelCorners,
    walls: levelWalls,
    roofSlopes: levelRoofSlopes,
  } = useActiveLevelEntities();

  const woflvBreakdown = React.useMemo(() => {
    if (levelRoofSlopes.length === 0) return null;
    const planes = resolveRoofSlopePlanes(
      levelCorners,
      levelWalls,
      levelRoofSlopes,
      [selectedRoom]
    );
    const maxCeilingCm =
      levelWalls.length > 0 ? Math.max(250, ...levelWalls.map((w) => w.heightCm)) : 250;
    const res = computeRoomWoFlVBreakdown(selectedRoom, planes, maxCeilingCm);
    return res.hasRoofSlopes ? res : null;
  }, [levelCorners, levelWalls, levelRoofSlopes, selectedRoom]);

  const fallbackName = `${t('inspector.room.defaultName')} ${roomIndex + 1}`;
  const displayName = selectedRoom.name ?? fallbackName;
  const [nameDraft, setNameDraft] = useState(displayName);

  useEffect(() => {
    setNameDraft(selectedRoom.name ?? fallbackName);
  }, [selectedRoom.id, selectedRoom.name, fallbackName]);

  const currentFlooring: FlooringType =
    selectedRoom.flooringType ?? 'microcement';
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const netArea = (selectedRoom.netAreaSqM ?? selectedRoom.areaSqM).toLocaleString(
    locale,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );

  // Calculate room perimeter in meters
  let perimeterCm = 0;
  const pts =
    selectedRoom.netCorners && selectedRoom.netCorners.length >= 3
      ? selectedRoom.netCorners
      : selectedRoom.corners;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    perimeterCm += Math.hypot(b.x - a.x, b.z - a.z);
  }
  const perimeterM = (perimeterCm / 100).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <section className="sidebar-section" data-testid="room-inspector">
      <h2 className="sidebar-title">
        <span>{t('inspector.room.titleWithName', { name: displayName })}</span>
        <Home size={14} aria-hidden="true" />
      </h2>

      <div className="form-grid">
        <div className="form-field full">
          <label className="form-label" htmlFor="room-name-input">
            {t('inspector.room.name')}
          </label>
          <input
            id="room-name-input"
            type="text"
            className="text-input"
            value={nameDraft}
            onChange={(e) => {
              const val = e.target.value;
              setNameDraft(val);
              if (val.trim().length > 0) {
                updateRoom(selectedRoom.id, { name: val });
              }
            }}
            onBlur={() => {
              const trimmed = nameDraft.trim();
              if (trimmed.length > 0) {
                setNameDraft(trimmed);
                updateRoom(selectedRoom.id, { name: trimmed });
              } else {
                setNameDraft(displayName);
              }
            }}
          />
        </div>

        <div className="form-field full">
          <label className="form-label" htmlFor="room-flooring-select">
            {t('inspector.room.flooring')}
          </label>
          <select
            id="room-flooring-select"
            className="select-input"
            value={currentFlooring}
            onChange={(e) =>
              updateRoom(selectedRoom.id, {
                flooringType: e.target.value as FlooringType,
              })
            }
          >
            {FLOORING_OPTION_KEYS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(`inspector.room.flooringOptions.${opt.key}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <span className="form-label">{t('inspector.room.netArea')}</span>
          <div className="readout-value">{netArea} m²</div>
        </div>

        <div className="form-field">
          <span className="form-label">{t('inspector.room.perimeter')}</span>
          <div className="readout-value">{perimeterM} m</div>
        </div>

        {woflvBreakdown && (
          <div className="form-field full" data-testid="room-woflv-readout">
            <span className="form-label">{t('inspector.room.woflvArea')}</span>
            <div className="readout-value" style={{ color: '#38bdf8' }}>
              {woflvBreakdown.woflvAreaSqM.toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              m²
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 400, marginTop: '3px' }}>
                {t('inspector.room.woflvBreakdown', {
                  full: woflvBreakdown.areaFullSqM.toFixed(2),
                  half: woflvBreakdown.areaHalfSqM.toFixed(2),
                  zero: woflvBreakdown.areaZeroSqM.toFixed(2),
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
