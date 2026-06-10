import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ReportRun, ScenarioResult } from '../App';

interface Props {
  run: ReportRun;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function TimelineTab({ run }: Props): React.ReactElement {
  // Build timeline data from scenarios
  const data = run.scenarios.map((sc: ScenarioResult, idx: number) => ({
    name: sc.name.length > 30 ? sc.name.slice(0, 27) + '...' : sc.name,
    fullName: sc.name,
    duration: sc.durationMs,
    durationSec: +(sc.durationMs / 1000).toFixed(2),
    status: sc.status,
    stepsCount: sc.steps.length,
    passedSteps: sc.steps.filter((s) => s.status === 'passed').length,
    index: idx,
  }));

  const totalDuration = run.durationMs;

  return (
    <div className="timeline-tab">
      <div className="tab-header">
        <h2 className="tab-title">Execution Timeline</h2>
        <div className="timeline-summary">
          <span className="ts-chip">Total: {formatDuration(totalDuration)}</span>
          <span className="ts-chip">Scenarios: {run.scenarios.length}</span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="chart-empty">No scenario data to display</div>
      ) : (
        <>
          <div className="panel timeline-chart-panel">
            <h3 className="panel-title">Scenario Duration</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50)}>
                <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 120, bottom: 10 }}>
                  <XAxis type="number" tickFormatter={(v: number) => `${v}s`} stroke="#6b7280" />
                  <YAxis type="category" dataKey="name" width={110} stroke="#6b7280" tick={{ fill: '#e4e6eb', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', color: '#e4e6eb' }}
                    formatter={(value: number) => [formatDuration(value), 'Duration']}
                    labelFormatter={(label: string) => label}
                  />
                  <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
                    {data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.status === 'passed' ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel timeline-detail-panel">
            <h3 className="panel-title">Scenario Breakdown</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Scenario</th>
                  <th>Status</th>
                  <th>Steps</th>
                  <th>Duration</th>
                  <th>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.index}>
                    <td>{d.index + 1}</td>
                    <td>{d.fullName}</td>
                    <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                    <td>{d.passedSteps}/{d.stepsCount}</td>
                    <td>{formatDuration(d.duration)}</td>
                    <td>
                      <div className="pct-bar-wrap">
                        <div
                          className={`pct-bar pct-bar-${d.status}`}
                          style={{ width: `${totalDuration > 0 ? (d.duration / totalDuration) * 100 : 0}%` }}
                        />
                        <span className="pct-label">{totalDuration > 0 ? ((d.duration / totalDuration) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
