import React, { useId, useState } from 'react';
import { PackagePlus, Plus } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export interface CustomFurnitureInput {
  name: string;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  color: string;
}

export interface CustomFurnitureFormSectionProps {
  onAddCustom: (item: CustomFurnitureInput) => void;
}

export const CustomFurnitureFormSection: React.FC<
  CustomFurnitureFormSectionProps
> = ({ onAddCustom }) => {
  const { t } = useTranslation();
  const defaultCustomName = t('inspector.customFurniture.defaultName');
  const [customName, setCustomName] = useState<string | null>(null);
  const effectiveCustomName = customName ?? defaultCustomName;
  const [customWidthCm, setCustomWidthCm] = useState(180);
  const [customHeightCm, setCustomHeightCm] = useState(85);
  const [customDepthCm, setCustomDepthCm] = useState(60);
  const [customColor, setCustomColor] = useState('#6366f1');

  const idCustomName = useId();
  const idCustomWidth = useId();
  const idCustomHeight = useId();
  const idCustomDepth = useId();
  const idCustomColor = useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCustom({
      name:
        (customName !== null ? customName.trim() : '') ||
        t('inspector.customFurniture.fallbackName'),
      widthCm: Math.max(1, Number(customWidthCm)),
      heightCm: Math.max(1, Number(customHeightCm)),
      depthCm: Math.max(1, Number(customDepthCm)),
      color: customColor,
    });
  };

  return (
    <section className="sidebar-section">
      <h2 className="sidebar-title">
        <span>{t('inspector.customFurniture.title')}</span>
        <PackagePlus size={14} aria-hidden="true" />
      </h2>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="form-field full">
          <label htmlFor={idCustomName} className="form-label">
            {t('inspector.customFurniture.name')}
          </label>
          <input
            id={idCustomName}
            name="customFurnitureName"
            autoComplete="off"
            type="text"
            className="text-input"
            value={effectiveCustomName}
            onChange={(e) => setCustomName(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor={idCustomWidth} className="form-label">
            {t('inspector.customFurniture.width')}
          </label>
          <input
            id={idCustomWidth}
            type="number"
            min={1}
            className="number-input"
            value={customWidthCm}
            onChange={(e) => setCustomWidthCm(Number(e.target.value))}
          />
        </div>
        <div className="form-field">
          <label htmlFor={idCustomHeight} className="form-label">
            {t('inspector.customFurniture.height')}
          </label>
          <input
            id={idCustomHeight}
            type="number"
            min={1}
            className="number-input"
            value={customHeightCm}
            onChange={(e) => setCustomHeightCm(Number(e.target.value))}
          />
        </div>
        <div className="form-field">
          <label htmlFor={idCustomDepth} className="form-label">
            {t('inspector.customFurniture.depth')}
          </label>
          <input
            id={idCustomDepth}
            type="number"
            min={1}
            className="number-input"
            value={customDepthCm}
            onChange={(e) => setCustomDepthCm(Number(e.target.value))}
          />
        </div>
        <div className="form-field">
          <label htmlFor={idCustomColor} className="form-label">
            {t('inspector.customFurniture.color')}
          </label>
          <input
            id={idCustomColor}
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
            <Plus size={14} aria-hidden="true" />
            <span>{t('inspector.customFurniture.add')}</span>
          </button>
        </div>
      </form>
    </section>
  );
};
