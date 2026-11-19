import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Top-level safety net so unexpected runtime or corrupted-storage errors
 * show a recoverable fallback UI instead of leaving a blank dark viewport.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    return { hasError: true, errorMessage: message };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Wohnung 3D Planner runtime error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAutosaveAndReload = () => {
    try {
      const saved = localStorage.getItem('wohnung_autosave');
      if (saved) {
        localStorage.setItem('wohnung_autosave.corrupt', saved);
        localStorage.removeItem('wohnung_autosave');
      }
    } catch {
      // ignore storage access issues
    }
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '24px',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
          }}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 700 }}>
            Wohnung 3D Planer – Renderfehler / Render Error
          </h1>
          <p
            style={{
              margin: '0 0 14px',
              fontSize: '0.88rem',
              color: '#cbd5e1',
              lineHeight: 1.5,
            }}
          >
            Die Ansicht konnte nicht geladen werden (z. B. durch einen beschädigten
            lokalen Zwischenspeicher oder fehlenden WebGL-Kontext).
          </p>
          {this.state.errorMessage && (
            <pre
              style={{
                margin: '0 0 16px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#fca5a5',
                fontSize: '0.78rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.errorMessage}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #475569',
                backgroundColor: '#334155',
                color: '#f8fafc',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Neu laden / Reload
            </button>
            <button
              type="button"
              onClick={this.handleResetAutosaveAndReload}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #0284c7',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Autosave zurücksetzen &amp; neu laden
            </button>
          </div>
        </div>
      </div>
    );
  }
}
