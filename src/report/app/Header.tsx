import React, { useState, useRef, useEffect } from 'react';
import type { ReportRun, ReportSummary } from './App';

interface Props {
  summaries: ReportSummary[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  currentRun: ReportRun | null;
  onMenuToggle: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function Header({ summaries, selectedRunId, onSelectRun, currentRun, onMenuToggle }: Props): React.ReactElement {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (): void => {
    if (selectedRunId) {
      window.open(`/api/reports/${selectedRunId}/export`, '_blank');
    }
  };

  const selectedSummary = summaries.find((s) => s.id === selectedRunId);

  return (
    <header className="app-header">
      <button className="menu-toggle" onClick={onMenuToggle}>☰</button>
      <div className="header-left">
        <div className="run-selector" ref={dropdownRef}>
          <button className="run-selector-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <span className="run-label">{selectedSummary?.runLabel ?? 'Select Run'}</span>
            {selectedSummary && (
              <span className={`status-dot status-dot-${selectedSummary.status}`} />
            )}
            <span className="dropdown-arrow">{dropdownOpen ? '▲' : '▼'}</span>
          </button>
          {dropdownOpen && (
            <div className="run-dropdown">
              {summaries.map((s) => (
                <button
                  key={s.id}
                  className={`run-dropdown-item ${s.id === selectedRunId ? 'active' : ''}`}
                  onClick={() => { onSelectRun(s.id); setDropdownOpen(false); }}
                >
                  <span className="run-dropdown-label">{s.runLabel}</span>
                  <span className="run-dropdown-feature">{s.featureName}</span>
                  <span className={`status-dot status-dot-${s.status}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        {currentRun && (
          <div className="header-info">
            <span className={`badge badge-${currentRun.status}`}>{currentRun.status}</span>
            <span className="header-feature-name">{currentRun.featureName}</span>
            <span className="header-duration">{formatDuration(currentRun.durationMs)}</span>
            {currentRun.environment && (
              <span className="header-env">{currentRun.environment.browser}</span>
            )}
          </div>
        )}
      </div>
      <div className="header-right">
        <button className="export-btn" onClick={handleExport} title="Export run as JSON">
          ↓ Export
        </button>
      </div>
    </header>
  );
}
