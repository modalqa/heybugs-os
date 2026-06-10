import React from 'react';
import type { ReportRun } from '../App';

interface Props {
  run: ReportRun;
}

export default function EnvironmentTab({ run }: Props): React.ReactElement {
  const env = run.environment;

  return (
    <div className="environment-tab">
      <div className="tab-header">
        <h2 className="tab-title">Environment</h2>
      </div>

      {!env ? (
        <div className="no-data">
          <p>No environment data was captured for this run.</p>
          <p className="no-data-hint">Environment info is collected when tests are executed with the runner.</p>
        </div>
      ) : (
        <div className="env-grid">
          <div className="env-card">
            <div className="env-card-icon">🌐</div>
            <div className="env-card-body">
              <div className="env-card-label">Browser</div>
              <div className="env-card-value">{env.browser}</div>
            </div>
          </div>

          <div className="env-card">
            <div className="env-card-icon">💻</div>
            <div className="env-card-body">
              <div className="env-card-label">Operating System</div>
              <div className="env-card-value">{env.os}</div>
            </div>
          </div>

          <div className="env-card">
            <div className="env-card-icon">⬢</div>
            <div className="env-card-body">
              <div className="env-card-label">Node.js Version</div>
              <div className="env-card-value">{env.nodeVersion}</div>
            </div>
          </div>

          {env.envName && (
            <div className="env-card">
              <div className="env-card-icon">🏷</div>
              <div className="env-card-body">
                <div className="env-card-label">Environment</div>
                <div className="env-card-value">{env.envName}</div>
              </div>
            </div>
          )}

          {env.baseUrl && (
            <div className="env-card">
              <div className="env-card-icon">🔗</div>
              <div className="env-card-body">
                <div className="env-card-label">Base URL</div>
                <div className="env-card-value env-url">{env.baseUrl}</div>
              </div>
            </div>
          )}

          <div className="env-card">
            <div className="env-card-icon">👁</div>
            <div className="env-card-body">
              <div className="env-card-label">Headless Mode</div>
              <div className="env-card-value">{env.headless !== false ? 'Yes' : 'No (Headed)'}</div>
            </div>
          </div>

          {env.timeoutMs && (
            <div className="env-card">
              <div className="env-card-icon">⏱</div>
              <div className="env-card-body">
                <div className="env-card-label">Timeout</div>
                <div className="env-card-value">{(env.timeoutMs / 1000).toFixed(0)}s</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Run metadata */}
      <div className="panel run-meta-panel">
        <h3 className="panel-title">Run Metadata</h3>
        <table className="data-table meta-table">
          <tbody>
            <tr>
              <td className="meta-label">Run ID</td>
              <td className="meta-value mono">{run.id}</td>
            </tr>
            <tr>
              <td className="meta-label">Run Label</td>
              <td className="meta-value">{run.runLabel}</td>
            </tr>
            <tr>
              <td className="meta-label">Timestamp</td>
              <td className="meta-value">{new Date(run.timestamp).toLocaleString()}</td>
            </tr>
            <tr>
              <td className="meta-label">Feature File</td>
              <td className="meta-value mono">{run.filePath ?? 'N/A'}</td>
            </tr>
            <tr>
              <td className="meta-label">Overall Status</td>
              <td className="meta-value">
                <span className={`badge badge-${run.status}`}>{run.status}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
