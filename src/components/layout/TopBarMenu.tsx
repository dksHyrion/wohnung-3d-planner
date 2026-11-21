import React, { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TopBarMenuProps {
  label: string;
  icon?: React.ReactNode;
  badge?: string | number | null;
  align?: 'left' | 'right';
  children: React.ReactNode;
}

/**
 * Compact native <details> dropdown menu for the TopBar.
 * Keeps actions accessible, collapses secondary controls into a clean popover,
 * and closes automatically on Escape or outside click.
 */
export const TopBarMenu: React.FC<TopBarMenuProps> = ({
  label,
  icon,
  badge,
  align = 'left',
  children,
}) => {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        el.open = false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      if (e.key === 'Escape') {
        el.open = false;
        const summary = el.querySelector('summary');
        if (summary instanceof HTMLElement) summary.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className="topbar-menu">
      <summary className="btn btn-outline topbar-menu-trigger">
        {icon}
        <span>{label}</span>
        {badge !== undefined && badge !== null && (
          <span className="topbar-menu-badge">{badge}</span>
        )}
        <ChevronDown size={13} aria-hidden="true" className="topbar-menu-chevron" />
      </summary>
      <div
        className={`topbar-menu-popover ${align === 'right' ? 'align-right' : ''}`}
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </details>
  );
};
