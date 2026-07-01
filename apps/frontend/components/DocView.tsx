'use client';
// Refactored DocView component

import React from 'react';
import { Asset } from '../types';
import { fmtBytes } from '../lib/utils';

interface DocViewProps {
  docTypeFilter: string;
  setDocTypeFilter: (filter: string) => void;
  docTypes: string[];
  selectedDocProject: string;
  docCollectionView: string;
  docsGrouped: [string, Asset[]][];
  selectedIds: string[];
  cardHandlers: (item: Asset, doubleClickCallback: () => void) => any;
  openDoc: (id: string) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

export default function DocView({
  docTypeFilter,
  setDocTypeFilter,
  docTypes,
  selectedDocProject,
  docCollectionView,
  docsGrouped,
  selectedIds,
  cardHandlers,
  openDoc,
  t
}: DocViewProps): React.JSX.Element {
  return (
    <section className="contentPane">
      <div className="docFilters">
        <span>{t('dashboard.specificType')}:</span>
        <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
          <option value="all">{t('sidebar.all')}</option>
          {docTypes.map((tVal) => <option key={tVal} value={tVal}>{tVal}</option>)}
        </select>
        {selectedDocProject !== 'all' && <span className="chip active">Project: {selectedDocProject}</span>}
      </div>

      {docCollectionView === 'trash' && <div className="hint">{t('dashboard.docsTrashHint')}</div>}
      {docsGrouped.length === 0 && <div className="hint">{t('dashboard.noDocsMatching')}</div>}

      {docsGrouped.map(([group, items]) => (
        <div key={group} className="docGroup">
          <div className="monthTitle">{group} · {items.length}</div>
          <div className="docGrid">
            {items.map((d, idx) => {
              const picked = selectedIds.includes(d.id);
              return (
                <div key={d.id} className={`docCard ${picked ? 'picked' : ''}`} {...cardHandlers(d, () => openDoc(d.id))} style={{ animationDelay: `${(idx % 24) * 0.02}s` }}>
                  <div className="docName">{d.originalName}</div>
                  <div className="docMeta">{fmtBytes(d.size)} · {d.mime || 'unknown'}</div>
                  {picked && <div className="badge">✓</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <style jsx>{`
        .contentPane {
          animation: contentSwitch .35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes contentSwitch {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .docFilters {
          margin-bottom: 16px;
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .docFilters select {
          background: var(--bg-input);
          color: var(--text-primary);
          border: 1px solid var(--border-input);
          border-radius: 8px;
          padding: 6px 12px;
          font-family: inherit;
          outline: none;
        }
        .chip {
          border: 1px solid var(--border-color);
          background: var(--bg-input);
          color: var(--text-secondary);
          border-radius: 99px;
          padding: 6px 14px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        .chip.active {
          background: var(--button-primary-bg);
          border-color: var(--button-primary-bg);
          color: var(--button-primary-text);
          box-shadow: 0 4px 10px var(--button-primary-shadow);
        }
        .hint {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 16px;
          font-style: italic;
        }
        .monthTitle {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 12px;
          color: var(--text-primary);
          letter-spacing: -0.2px;
        }
        .docGroup {
          margin-bottom: 24px;
        }
        .docGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .docCard {
          background: var(--bg-tile);
          border: 1px solid var(--border-tile);
          border-radius: 14px;
          padding: 14px;
          cursor: pointer;
          position: relative;
          box-shadow: var(--card-shadow);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          animation: cardEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .docCard:hover {
          transform: translateY(-2px);
          border-color: var(--border-tile-hover);
          box-shadow: var(--card-shadow-hover);
        }
        .docCard.picked {
          border-color: var(--button-primary-bg);
          box-shadow: 0 0 0 1px var(--button-primary-bg);
        }
        .docName {
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 14px;
        }
        .docMeta {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 500;
        }
        .badge {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 22px;
          height: 22px;
          border-radius: 99px;
          background: var(--button-primary-bg);
          color: var(--button-primary-text);
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 11px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
          z-index: 2;
        }
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
