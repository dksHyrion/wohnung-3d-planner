import React, { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { FlooringType, RoomPolygon } from '../../core/types';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { computeRoomWoFlVBreakdown, resolveRoofSlopePlanes } from '../../core/roofSlopeMath';

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
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roofSlopes = useFloorplanStore((s) => s.roofSlopes);

  const woflvBreakdown = React.useMemo(() => {
    if (!roofSlopes || roofSlopes.length === 0) return null;
    const planes = resolveRoofSlopePlanes(corners, walls, roofSlopes, [selectedRoom]);
    const maxCeilingCm = walls.length > 0 ? Math.max(250, ...walls.map((w) => w.heightCm)) : 250;
    const res = computeRoomWoFlVBreakdown(selectedRoom, planes, maxCeilingCm);
    return res.hasRoofSlopes ? res : null;
  }, [corners, walls, roofSlopes, selectedRoom]);

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
      <div className="sidebar-title">
        <span>{t('inspector.room.titleWithName', { name: displayName })}</span>
        <Home size={14} />
      </div>

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
          <label className="form-label">{t('inspector.room.netArea')}</label>
          <div
            style={{
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#f8fafc',
              padding: '6px 8px',
              background: 'rgba(15, 23, 42, 0.55)',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
            }}
          >
            {netArea} m²
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">{t('inspector.room.perimeter')}</label>
          <div
            style={{
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#f8fafc',
              padding: '6px 8px',
              background: 'rgba(15, 23, 42, 0.55)',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
            }}
          >
            {perimeterM} m
          </div>
        </div>

        {woflvBreakdown && (
          <div className="form-field full" data-testid="room-woflv-readout">
            <label className="form-label">{t('inspector.room.woflvArea')}</label>
            <div
              style={{
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#38bdf8',
                padding: '6px 8px',
                background: 'rgba(15, 23, 42, 0.55)',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
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
