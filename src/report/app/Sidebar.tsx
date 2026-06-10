import React from 'react';
import type { TabId } from './App';

interface Props {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: TabId;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'EXECUTION',
    items: [
      { id: 'overview', label: 'Overview', icon: '⊞' },
      { id: 'features', label: 'Features', icon: '☰' },
      { id: 'timeline', label: 'Timeline', icon: '▬' },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { id: 'ai-activity', label: 'AI Activity', icon: '✦' },
      { id: 'environment', label: 'Environment', icon: '⚙' },
    ],
  },
  {
    title: 'ARTIFACTS',
    items: [
      { id: 'attachments', label: 'Attachments', icon: '📎' },
    ],
  },
];

export default function Sidebar({ activeTab, onNavigate, isOpen, onClose }: Props): React.ReactElement {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">◆</span>
          <span className="brand-text">heybugs</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="nav-group">
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'nav-item-active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="footer-version">v1.0.0</span>
        </div>
      </aside>
    </>
  );
}
