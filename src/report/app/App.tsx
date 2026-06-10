import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import OverviewTab from './tabs/OverviewTab';
import FeaturesTab from './tabs/FeaturesTab';
import TimelineTab from './tabs/TimelineTab';
import AiActivityTab from './tabs/AiActivityTab';
import EnvironmentTab from './tabs/EnvironmentTab';
import AttachmentsTab from './tabs/AttachmentsTab';

/* ---------- shared types ---------- */
export interface StepResult {
  step: { keyword: string; text: string };
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  aiUsed?: boolean;
  aiSuccess?: boolean;
  screenshotPath?: string;
}

export interface ScenarioResult {
  name: string;
  status: 'passed' | 'failed';
  steps: StepResult[];
  durationMs: number;
}

export interface AiStepRecord {
  stepText: string;
  action: string;
  success: boolean;
  error?: string;
}

export interface RunEnvironment {
  browser: string;
  os: string;
  nodeVersion: string;
  envName?: string;
  baseUrl?: string;
  headless?: boolean;
  timeoutMs?: number;
}

export interface RunArtifacts {
  screenshots: string[];
  videoPath?: string;
  tracePath?: string;
  consoleLog?: string;
}

export interface ReportRun {
  id: string;
  runLabel: string;
  timestamp: string;
  featureName: string;
  status: 'passed' | 'failed';
  durationMs: number;
  scenarios: ScenarioResult[];
  filePath?: string;
  environment?: RunEnvironment;
  aiInvocations: number;
  aiSuccess: number;
  aiFailed: number;
  aiSteps: AiStepRecord[];
  artifacts?: RunArtifacts;
  stepCount: number;
  passedStepCount: number;
  failedStepCount: number;
  skippedStepCount: number;
}

export interface ReportSummary {
  id: string;
  runLabel: string;
  timestamp: string;
  featureName: string;
  status: 'passed' | 'failed';
  durationMs: number;
  scenarioCount: number;
  passedCount: number;
  failedCount: number;
  stepCount: number;
  passedStepCount: number;
  failedStepCount: number;
  skippedStepCount: number;
  filePath?: string;
  environment?: RunEnvironment;
  aiInvocations: number;
  aiSuccess: number;
  aiFailed: number;
}

export type TabId = 'overview' | 'features' | 'timeline' | 'ai-activity' | 'environment' | 'attachments';

function getTabFromHash(): TabId {
  const hash = window.location.hash;
  const match = hash.match(/^#\/(.+)$/);
  if (match) {
    const tab = match[1] as TabId;
    if (['overview', 'features', 'timeline', 'ai-activity', 'environment', 'attachments'].includes(tab)) {
      return tab;
    }
  }
  return 'overview';
}

export default function App(): React.ReactElement {
  const [summaries, setSummaries] = useState<ReportSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<ReportRun | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(getTabFromHash);
  const [loading, setLoading] = useState(true);
  const [runLoading, setRunLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load summaries on mount
  useEffect(() => {
    fetch('/api/reports')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ReportSummary[]) => {
        setSummaries(data);
        if (data.length > 0 && !selectedRunId) {
          setSelectedRunId(data[0].id);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Load full report when selectedRunId changes
  useEffect(() => {
    if (!selectedRunId) return;
    setRunLoading(true);
    fetch(`/api/reports/${selectedRunId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ReportRun) => {
        setCurrentRun(data);
        setRunLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setRunLoading(false);
      });
  }, [selectedRunId]);

  // Hash-based routing
  useEffect(() => {
    const onHashChange = (): void => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((tab: TabId) => {
    window.location.hash = `#/${tab}`;
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading reports...</p>
      </div>
    );
  }

  if (error && summaries.length === 0) {
    return (
      <div className="app-loading">
        <p className="error-text">Failed to load reports: {error}</p>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="app-loading">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h2>No reports yet</h2>
          <p>Run some tests to generate reports:</p>
          <code>node dist/cli.js run examples/</code>
        </div>
      </div>
    );
  }

  const renderTab = (): React.ReactNode => {
    if (runLoading) {
      return <div className="tab-loading"><div className="spinner" /><p>Loading run data...</p></div>;
    }
    if (!currentRun) {
      return <div className="tab-loading"><p className="error-text">No run selected</p></div>;
    }
    switch (activeTab) {
      case 'overview': return <OverviewTab run={currentRun} />;
      case 'features': return <FeaturesTab run={currentRun} />;
      case 'timeline': return <TimelineTab run={currentRun} />;
      case 'ai-activity': return <AiActivityTab run={currentRun} />;
      case 'environment': return <EnvironmentTab run={currentRun} />;
      case 'attachments': return <AttachmentsTab run={currentRun} />;
      default: return <OverviewTab run={currentRun} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onNavigate={navigate} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <Header
          summaries={summaries}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          currentRun={currentRun}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="tab-content">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}
