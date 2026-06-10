import React, { useState } from 'react';
import type { ReportRun, AiStepRecord } from '../App';

interface Props {
  run: ReportRun;
}

export default function AiActivityTab({ run }: Props): React.ReactElement {
  const { aiInvocations, aiSuccess, aiFailed, aiSteps } = run;
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const successRate = aiInvocations > 0 ? ((aiSuccess / aiInvocations) * 100).toFixed(1) : '0.0';

  return (
    <div className="ai-activity-tab">
      <div className="tab-header">
        <h2 className="tab-title">AI Activity</h2>
      </div>

      {/* Stats Cards */}
      <div className="ai-stats-grid">
        <div className="ai-stat-card">
          <div className="ai-stat-icon">✦</div>
          <div className="ai-stat-body">
            <div className="ai-stat-value">{aiInvocations}</div>
            <div className="ai-stat-label">Total Invocations</div>
          </div>
        </div>
        <div className="ai-stat-card ai-card-success">
          <div className="ai-stat-icon">✓</div>
          <div className="ai-stat-body">
            <div className="ai-stat-value">{aiSuccess}</div>
            <div className="ai-stat-label">Successful</div>
          </div>
        </div>
        <div className="ai-stat-card ai-card-failed">
          <div className="ai-stat-icon">✕</div>
          <div className="ai-stat-body">
            <div className="ai-stat-value">{aiFailed}</div>
            <div className="ai-stat-label">Failed</div>
          </div>
        </div>
        <div className="ai-stat-card ai-card-rate">
          <div className="ai-stat-icon">%</div>
          <div className="ai-stat-body">
            <div className="ai-stat-value">{successRate}%</div>
            <div className="ai-stat-label">Success Rate</div>
          </div>
        </div>
      </div>

      {/* AI Steps List */}
      <div className="panel ai-steps-panel">
        <h3 className="panel-title">AI-Interpreted Steps</h3>

        {aiSteps.length === 0 ? (
          <div className="no-data">
            <p>No AI activity was recorded during this run.</p>
            <p className="no-data-hint">AI activity appears when selectors fail and the AI self-healing system kicks in.</p>
          </div>
        ) : (
          <div className="ai-steps-list">
            {aiSteps.map((step: AiStepRecord, idx: number) => (
              <div
                key={idx}
                className={`ai-step-card ${step.success ? 'ai-card-pass' : 'ai-card-fail'}`}
                onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
              >
                <div className="ai-step-header">
                  <span className={`ai-step-status ${step.success ? 'status-pass' : 'status-fail'}`}>
                    {step.success ? '✓' : '✕'}
                  </span>
                  <div className="ai-step-main">
                    <span className="ai-step-text">{step.stepText}</span>
                  </div>
                  <span className="ai-step-action-badge">{step.action}</span>
                  <span className="expand-icon">{expandedStep === idx ? '▼' : '▶'}</span>
                </div>
                {expandedStep === idx && (
                  <div className="ai-step-detail">
                    <div className="detail-row">
                      <span className="detail-label">Action:</span>
                      <span className="detail-value">{step.action}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Result:</span>
                      <span className={`detail-value ${step.success ? 'text-pass' : 'text-fail'}`}>
                        {step.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    {step.error && (
                      <div className="detail-row">
                        <span className="detail-label">Error:</span>
                        <pre className="detail-error">{step.error}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
