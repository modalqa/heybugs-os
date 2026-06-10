import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { ReportRun, ScenarioResult, StepResult } from '../App';

interface Props {
  run: ReportRun;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

/* ---- Circular Progress (SVG) ---- */
function CircularProgress({ value, size = 100, strokeWidth = 8 }: { value: number; size?: number; strokeWidth?: number }): React.ReactElement {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#22c55e' : value >= 50 ? '#eab308' : '#ef4444';

  return (
    <svg width={size} height={size} className="circular-progress">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="progress-text">
        {value.toFixed(0)}%
      </text>
    </svg>
  );
}

/* ---- Donut Chart ---- */
function ResultDonut({ passed, failed, skipped }: { passed: number; failed: number; skipped: number }): React.ReactElement {
  const data = [
    { name: 'Passed', value: passed, color: '#22c55e' },
    { name: 'Failed', value: failed, color: '#ef4444' },
    { name: 'Skipped', value: skipped, color: '#6b7280' },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="chart-empty">No data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', color: '#e4e6eb' }}
          formatter={(value: number, name: string) => [value, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ---- Failure Summary ---- */
function FailureSummary({ run }: { run: ReportRun }): React.ReactElement {
  const [expanded, setExpanded] = useState<number | null>(null);
  const failures: { scenario: string; step: StepResult }[] = [];

  for (const sc of run.scenarios) {
    for (const step of sc.steps) {
      if (step.status === 'failed') {
        failures.push({ scenario: sc.name, step });
      }
    }
  }

  if (failures.length === 0) {
    return (
      <div className="panel failure-panel">
        <h3 className="panel-title">Failure Summary</h3>
        <div className="no-failures">No failures in this run</div>
      </div>
    );
  }

  return (
    <div className="panel failure-panel">
      <h3 className="panel-title">Failure Summary <span className="count-badge">{failures.length}</span></h3>
      <div className="failure-list">
        {failures.map((f, i) => (
          <div key={i} className="failure-item" onClick={() => setExpanded(expanded === i ? null : i)}>
            <div className="failure-header-row">
              <span className="failure-icon">✕</span>
              <div className="failure-info">
                <span className="failure-step">{f.step.step.keyword} {f.step.step.text}</span>
                <span className="failure-scenario">in {f.scenario}</span>
              </div>
              <span className="expand-icon">{expanded === i ? '▼' : '▶'}</span>
            </div>
            {expanded === i && f.step.error && (
              <pre className="failure-error">{f.step.error}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Feature Results Table ---- */
function FeatureResultsTable({ run }: { run: ReportRun }): React.ReactElement {
  const [expandedScenarios, setExpandedScenarios] = useState<Set<number>>(new Set());

  const toggle = (idx: number): void => {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="panel feature-table-panel">
      <h3 className="panel-title">Feature Results</h3>
      <div className="feature-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Status</th>
              <th>Steps</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {run.scenarios.map((sc: ScenarioResult, idx: number) => {
              const passedSteps = sc.steps.filter((s) => s.status === 'passed').length;
              return (
                <React.Fragment key={idx}>
                  <tr className="scenario-row" onClick={() => toggle(idx)}>
                    <td>
                      <span className="expand-icon">{expandedScenarios.has(idx) ? '▼' : '▶'}</span>
                      {' '}{sc.name}
                    </td>
                    <td><span className={`badge badge-${sc.status}`}>{sc.status}</span></td>
                    <td>{passedSteps}/{sc.steps.length}</td>
                    <td>{formatDuration(sc.durationMs)}</td>
                  </tr>
                  {expandedScenarios.has(idx) && (
                    <tr className="steps-detail-row">
                      <td colSpan={4}>
                        <table className="steps-subtable">
                          <thead>
                            <tr><th>Step</th><th>Status</th><th>Duration</th></tr>
                          </thead>
                          <tbody>
                            {sc.steps.map((step: StepResult, si: number) => (
                              <tr key={si} className={`step-row step-row-${step.status}`}>
                                <td>
                                  <span className="step-kw">{step.step.keyword}</span> {step.step.text}
                                  {step.error && <div className="step-err">{step.error}</div>}
                                </td>
                                <td><span className={`badge badge-${step.status}`}>{step.status}</span></td>
                                <td>{formatDuration(step.durationMs)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- AI Activity Mini Panel ---- */
function AiActivityMini({ run }: { run: ReportRun }): React.ReactElement {
  const { aiInvocations, aiSuccess, aiFailed, aiSteps, tokens, totalCost } = run;

  return (
    <div className="panel ai-mini-panel">
      <h3 className="panel-title">AI Activity</h3>
      {aiInvocations === 0 ? (
        <div className="no-ai">No AI activity recorded</div>
      ) : (
        <>
          <div className="ai-stats-row">
            <div className="ai-stat">
              <span className="ai-stat-value">{aiInvocations}</span>
              <span className="ai-stat-label">Total</span>
            </div>
            <div className="ai-stat ai-stat-passed">
              <span className="ai-stat-value">{aiSuccess}</span>
              <span className="ai-stat-label">Success</span>
            </div>
            <div className="ai-stat ai-stat-failed">
              <span className="ai-stat-value">{aiFailed}</span>
              <span className="ai-stat-label">Failed</span>
            </div>
          </div>
          {tokens && (
            <div className="ai-tokens-row">
              <div className="ai-token-stat">
                <span className="ai-token-value">{tokens.promptTokens}</span>
                <span className="ai-token-label">Prompt Tokens</span>
              </div>
              <div className="ai-token-stat">
                <span className="ai-token-value">{tokens.completionTokens}</span>
                <span className="ai-token-label">Completion Tokens</span>
              </div>
              <div className="ai-token-stat">
                <span className="ai-token-value">{tokens.totalTokens}</span>
                <span className="ai-token-label">Total Tokens</span>
              </div>
            </div>
          )}
          {totalCost !== undefined && (
            <div className="ai-cost-row">
              <span className="ai-cost-label">Total Cost:</span>
              <span className="ai-cost-value">${totalCost.toFixed(6)}</span>
            </div>
          )}
          <div className="ai-recent">
            <div className="ai-recent-title">Recent AI Steps</div>
            {aiSteps.slice(0, 5).map((step, i) => (
              <div key={i} className={`ai-step-item ${step.success ? 'ai-success' : 'ai-fail'}`}>
                <span className="ai-step-icon">{step.success ? '✓' : '✕'}</span>
                <div className="ai-step-info">
                  <span className="ai-step-text">{step.stepText}</span>
                  <span className="ai-step-action">{step.action}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Main Overview Tab ---- */
export default function OverviewTab({ run }: Props): React.ReactElement {
  const totalScenarios = run.scenarios.length;
  const passedScenarios = run.scenarios.filter((s) => s.status === 'passed').length;
  const failedScenarios = totalScenarios - passedScenarios;
  const { stepCount, passedStepCount, failedStepCount, skippedStepCount } = run;
  const passRate = stepCount > 0 ? (passedStepCount / stepCount) * 100 : 0;

  return (
    <div className="overview-tab">
      {/* Top Metric Cards */}
      <div className="metric-row">
        <div className={`metric-card metric-status metric-${run.status}`}>
          <div className="metric-value">{run.status.toUpperCase()}</div>
          <div className="metric-label">Status</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">1</div>
          <div className="metric-label">Features</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{totalScenarios}</div>
          <div className="metric-label">Scenarios</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{stepCount}</div>
          <div className="metric-label">Steps</div>
        </div>
        <div className="metric-card metric-passed">
          <div className="metric-value">{passedStepCount}</div>
          <div className="metric-label">Passed</div>
        </div>
        <div className="metric-card metric-failed">
          <div className="metric-value">{failedStepCount}</div>
          <div className="metric-label">Failed</div>
        </div>
        <div className="metric-card metric-skipped">
          <div className="metric-value">{skippedStepCount}</div>
          <div className="metric-label">Skipped</div>
        </div>
        <div className="metric-card metric-rate">
          <CircularProgress value={passRate} size={80} strokeWidth={6} />
          <div className="metric-label">Pass Rate</div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="overview-middle">
        <div className="overview-col overview-col-left">
          <FailureSummary run={run} />
        </div>
        <div className="overview-col overview-col-center">
          <div className="panel donut-panel">
            <h3 className="panel-title">Result Distribution</h3>
            <ResultDonut passed={passedStepCount} failed={failedStepCount} skipped={skippedStepCount} />
            <div className="donut-legend">
              <span className="legend-item"><span className="legend-dot legend-passed" />Passed ({passedStepCount})</span>
              <span className="legend-item"><span className="legend-dot legend-failed" />Failed ({failedStepCount})</span>
              <span className="legend-item"><span className="legend-dot legend-skipped" />Skipped ({skippedStepCount})</span>
            </div>
          </div>
        </div>
        <div className="overview-col overview-col-right">
          <AiActivityMini run={run} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="overview-bottom">
        <FeatureResultsTable run={run} />
      </div>

      {/* Footer info */}
      <div className="overview-footer">
        <span>Run: {run.runLabel}</span>
        <span>Timestamp: {formatTimestamp(run.timestamp)}</span>
        <span>Duration: {formatDuration(run.durationMs)}</span>
        {run.environment && <span>Browser: {run.environment.browser}</span>}
      </div>
    </div>
  );
}
