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
          color: #a1a1aa;
        }
        .docFilters select {
          background: rgba(255, 255, 255, 0.03);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 6px 12px;
          font-family: inherit;
          outline: none;
        }
        .chip {
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          color: #a1a1aa;
          border-radius: 99px;
          padding: 6px 14px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        .chip.active {
          background: #ffffff;
          border-color: #ffffff;
          color: #09090b;
          box-shadow: 0 4px 10px rgba(255, 255, 255, 0.1);
        }
        .hint {
          font-size: 13px;
          color: #71717a;
          margin-bottom: 16px;
          font-style: italic;
        }
        .monthTitle {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #e4e4e7;
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
          background: #111113;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 14px;
          padding: 14px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          animation: cardEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .docCard:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }
        .docCard.picked {
          border-color: #ffffff;
          box-shadow: 0 0 0 1px #ffffff;
        }
        .docName {
          font-weight: 600;
          color: #f4f4f5;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 14px;
        }
        .docMeta {
          font-size: 11px;
          color: #71717a;
          font-weight: 500;
        }
        .badge {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 22px;
          height: 22px;
          border-radius: 99px;
          background: #ffffff;
          color: #09090b;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 11px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
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
