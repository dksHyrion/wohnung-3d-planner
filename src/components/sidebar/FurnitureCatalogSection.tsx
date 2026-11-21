import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  CatalogFurnitureTemplate,
  getCatalogCategoryLabel,
  getCatalogItemName,
} from '../../core/presets';
import { useTranslation } from '../../i18n/useTranslation';

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

export interface FurnitureCatalogSectionProps {
  catalog: CatalogFurnitureTemplate[];
  initialFilter?: CatalogFilterTab;
  onAddTemplate: (template: CatalogFurnitureTemplate) => void;
}

export const FurnitureCatalogSection: React.FC<FurnitureCatalogSectionProps> = ({
  catalog,
  initialFilter = 'all',
  onAddTemplate,
}) => {
  const { t, language } = useTranslation();
  const [catalogFilter, setCatalogFilter] =
    useState<CatalogFilterTab>(initialFilter);

  const filteredCatalog = useMemo(
    () => filterCatalogTemplates(catalog, catalogFilter),
    [catalog, catalogFilter]
  );

  return (
    <section className="sidebar-section">
      <h2 className="sidebar-title">
        <span>{t('inspector.catalogTitle')}</span>
        <Plus size={14} aria-hidden="true" />
      </h2>

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
          {t('inspector.catalogTabs.all')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalogFilter === 'real'}
          className={`btn ${catalogFilter === 'real' ? 'active' : ''}`}
          style={{ flex: 1.6, padding: '4px 6px', fontSize: '0.72rem' }}
          onClick={() => setCatalogFilter('real')}
        >
          {t('inspector.catalogTabs.real')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={catalogFilter === 'placeholder'}
          className={`btn ${catalogFilter === 'placeholder' ? 'active' : ''}`}
          style={{ flex: 1, padding: '4px 6px', fontSize: '0.72rem' }}
          onClick={() => setCatalogFilter('placeholder')}
        >
          {t('inspector.catalogTabs.placeholder')}
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
            {t('inspector.catalogEmpty')}
          </div>
        ) : (
          filteredCatalog.map((tpl) => (
            <button
              key={tpl.name}
              type="button"
              className="catalog-item-btn"
              onClick={() => onAddTemplate(tpl)}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {getCatalogItemName(tpl, language)}
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
                        ? `🟢 ${tpl.brand} · ${t('inspector.catalogRealBadge')}`
                        : `🟢 ${t('inspector.catalogRealBadge')}`
                      : `⚪ ${t('inspector.catalogPlaceholderBadge')}`}
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  {tpl.widthCm} × {tpl.heightCm} × {tpl.depthCm} cm{' '}
                  {t('inspector.catalogDimensions')} ·{' '}
                  {getCatalogCategoryLabel(tpl.category, language)}
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
  );
};
