import React, { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { FlooringType, RoomPolygon } from '../../core/types';
import { useFloorplanStore } from '../../store/useFloorplanStore';

export interface RoomInspectorProps {
  selectedRoom: RoomPolygon;
  roomIndex: number;
}

const FLOORING_OPTIONS: { value: FlooringType; label: string }[] = [
  { value: 'parquet', label: 'Eichenparkett (Warmholz)' },
  { value: 'microcement', label: 'Mikrozement / Sichtestrich' },
  { value: 'tile', label: 'Feinsteinzeug-Fliese' },
];

export const RoomInspector: React.FC<RoomInspectorProps> = ({
  selectedRoom,
  roomIndex,
}) => {
  const updateRoom = useFloorplanStore((s) => s.updateRoom);

  const displayName = selectedRoom.name ?? `Raum ${roomIndex + 1}`;
  const [nameDraft, setNameDraft] = useState(displayName);

  useEffect(() => {
    setNameDraft(selectedRoom.name ?? `Raum ${roomIndex + 1}`);
  }, [selectedRoom.id, selectedRoom.name, roomIndex]);

  const currentFlooring: FlooringType =
    selectedRoom.flooringType ?? 'microcement';
  const netArea = (selectedRoom.netAreaSqM ?? selectedRoom.areaSqM).toLocaleString(
    'de-DE',
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
  const perimeterM = (perimeterCm / 100).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <section className="sidebar-section" data-testid="room-inspector">
      <div className="sidebar-title">
        <span>Raum ({displayName})</span>
        <Home size={14} />
      </div>

      <div className="form-grid">
        <div className="form-field full">
          <label className="form-label" htmlFor="room-name-input">
            Raumbezeichnung
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
            Bodenbelag (3D-Material)
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
            {FLOORING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="form-label">Netto-Wohnfläche</label>
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
          <label className="form-label">Innenumfang</label>
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
      </div>
    </section>
  );
};
