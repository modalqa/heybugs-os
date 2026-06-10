import React, { useState } from 'react';
import type { ReportRun } from '../App';

interface Props {
  run: ReportRun;
}

export default function AttachmentsTab({ run }: Props): React.ReactElement {
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const artifacts = run.artifacts;
  const screenshots = artifacts?.screenshots ?? [];

  // Build artifact URL for serving
  const artifactUrl = (filename: string): string =>
    `/api/reports/${run.id}/artifacts/${encodeURIComponent(filename)}`;

  const hasAnyArtifacts = screenshots.length > 0 || artifacts?.videoPath || artifacts?.tracePath || artifacts?.consoleLog;

  return (
    <div className="attachments-tab">
      <div className="tab-header">
        <h2 className="tab-title">Attachments</h2>
      </div>

      {!hasAnyArtifacts ? (
        <div className="no-data">
          <p>No attachments were captured for this run.</p>
          <p className="no-data-hint">Screenshots are captured on step failure. Traces and videos require configuration.</p>
        </div>
      ) : (
        <>
          {/* Screenshots */}
          {screenshots.length > 0 && (
            <div className="panel attachments-panel">
              <h3 className="panel-title">Screenshots <span className="count-badge">{screenshots.length}</span></h3>
              <div className="screenshot-grid">
                {screenshots.map((path: string, idx: number) => {
                  const filename = path.split('/').pop() ?? path;
                  const url = artifactUrl(filename);
                  return (
                    <div key={idx} className="screenshot-card" onClick={() => setSelectedScreenshot(url)}>
                      <div className="screenshot-thumb">
                        <img src={url} alt={`Screenshot ${idx + 1}`} loading="lazy" />
                      </div>
                      <div className="screenshot-label">{filename}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Video */}
          {artifacts?.videoPath && (
            <div className="panel attachments-panel">
              <h3 className="panel-title">Video Recording</h3>
              <div className="video-container">
                <video controls preload="metadata">
                  <source src={artifactUrl(artifacts.videoPath.split('/').pop() ?? '')} type="video/webm" />
                  Your browser does not support video playback.
                </video>
              </div>
              <a
                href={artifactUrl(artifacts.videoPath.split('/').pop() ?? '')}
                download
                className="download-link"
              >
                ↓ Download video
              </a>
            </div>
          )}

          {/* Trace */}
          {artifacts?.tracePath && (
            <div className="panel attachments-panel">
              <h3 className="panel-title">Trace</h3>
              <div className="trace-info">
                <p>A Playwright trace file was captured for this run.</p>
                <a
                  href={artifactUrl(artifacts.tracePath.split('/').pop() ?? '')}
                  download
                  className="download-link"
                >
                  ↓ Download trace.zip
                </a>
                <p className="trace-hint">
                  Open with: <code>npx playwright show-trace trace.zip</code>
                </p>
              </div>
            </div>
          )}

          {/* Console Log */}
          {artifacts?.consoleLog && (
            <div className="panel attachments-panel">
              <h3 className="panel-title">Console Log</h3>
              <pre className="console-log-viewer">{artifacts.consoleLog}</pre>
            </div>
          )}
        </>
      )}

      {/* Screenshot Lightbox */}
      {selectedScreenshot && (
        <div className="lightbox" onClick={() => setSelectedScreenshot(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setSelectedScreenshot(null)}>✕</button>
            <img src={selectedScreenshot} alt="Screenshot" className="lightbox-img" />
          </div>
        </div>
      )}
    </div>
  );
}
