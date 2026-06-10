import React, { useState } from 'react';
import type { ReportRun, ScenarioResult, StepResult } from '../App';

interface Props {
  run: ReportRun;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

type Filter = 'all' | 'passed' | 'failed';

export default function FeaturesTab({ run }: Props): React.ReactElement {
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedScenarios, setExpandedScenarios] = useState<Set<number>>(new Set());

  const toggle = (idx: number): void => {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const filteredScenarios = run.scenarios.filter((sc) => {
    if (filter === 'all') return true;
    return sc.status === filter;
  });

  const totalSteps = run.scenarios.reduce((sum, sc) => sum + sc.steps.length, 0);
  const passedSteps = run.scenarios.reduce((sum, sc) => sum + sc.steps.filter((s) => s.status === 'passed').length, 0);
  const failedSteps = run.scenarios.reduce((sum, sc) => sum + sc.steps.filter((s) => s.status === 'failed').length, 0);

  return (
    <div className="features-tab">
      <div className="tab-header">
        <h2 className="tab-title">Feature: {run.featureName}</h2>
        <div className="filter-bar">
          {(['all', 'passed', 'failed'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'filter-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="filter-count">
                {f === 'all' ? run.scenarios.length : run.scenarios.filter((sc) => sc.status === f).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="feature-summary-bar">
        <div className="summary-chip">
          <span className="chip-label">Scenarios</span>
          <span className="chip-value">{run.scenarios.length}</span>
        </div>
        <div className="summary-chip chip-passed">
          <span className="chip-label">Steps Passed</span>
          <span className="chip-value">{passedSteps}/{totalSteps}</span>
        </div>
        <div className="summary-chip chip-failed">
          <span className="chip-label">Steps Failed</span>
          <span className="chip-value">{failedSteps}</span>
        </div>
        <div className="summary-chip">
          <span className="chip-label">Duration</span>
          <span className="chip-value">{formatDuration(run.durationMs)}</span>
        </div>
      </div>

      <div className="scenario-list">
        {filteredScenarios.map((sc: ScenarioResult, idx: number) => {
          const originalIdx = run.scenarios.indexOf(sc);
          const passedCount = sc.steps.filter((s) => s.status === 'passed').length;
          const failedCount = sc.steps.filter((s) => s.status === 'failed').length;
          const isExpanded = expandedScenarios.has(originalIdx);

          return (
            <div key={idx} className={`scenario-card scenario-${sc.status}`}>
              <div className="scenario-header" onClick={() => toggle(originalIdx)}>
                <span className={`badge badge-${sc.status}`}>{sc.status}</span>
                <span className="scenario-name">{sc.name}</span>
                <div className="scenario-stats">
                  <span className="sc-passed">{passedCount} passed</span>
                  {failedCount > 0 && <span className="sc-failed">{failedCount} failed</span>}
                  <span className="sc-total">{sc.steps.length} total</span>
                </div>
                <span className="scenario-duration">{formatDuration(sc.durationMs)}</span>
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
              </div>
              {isExpanded && (
                <div className="scenario-body">
                  <table className="steps-subtable">
                    <thead>
                      <tr><th>Step</th><th>Status</th><th>Duration</th></tr>
                    </thead>
                    <tbody>
                      {sc.steps.map((step: StepResult, si: number) => (
                        <tr key={si} className={`step-row step-row-${step.status}`}>
                          <td>
                            <span className="step-kw">{step.step.keyword}</span> {step.step.text}
                            {step.aiUsed && <span className="ai-badge">AI</span>}
                            {step.error && <div className="step-err">{step.error}</div>}
                          </td>
                          <td><span className={`badge badge-${step.status}`}>{step.status}</span></td>
                          <td>{formatDuration(step.durationMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
