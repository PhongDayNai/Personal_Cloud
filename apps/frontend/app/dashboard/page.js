'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function getApiOrigin() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'hc.example.com') return 'https://api.example.com';
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:45174';
  }
  return process.env.NEXT_PUBLIC_API_ORIGIN || process.env.API_ORIGIN || 'http://localhost:45174';
}

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function getDocType(item) {
  if (item.ext && item.ext.trim()) return item.ext.toLowerCase();
  if (item.mime && item.mime.trim()) return `mime:${item.mime.toLowerCase()}`;
  return 'no-extension';
}

const LONG_PRESS_MS = 420;

export default function DashboardPage() {
  const api = useMemo(() => getApiOrigin(), []);

  const [usage, setUsage] = useState(null);
  const [assets, setAssets] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const [tab, setTab] = useState('media'); // media | docs
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [activeIndex, setActiveIndex] = useState(-1); // lightbox index in mediaAssets

  const [docTypeFilter, setDocTypeFilter] = useState('all');

  const longPressRef = useRef(null);

  const mediaAssets = useMemo(
    () => assets.filter((a) => a.type === 'image' || a.type === 'video'),
    [assets]
  );

  const docAssets = useMemo(
    () => assets.filter((a) => a.type !== 'image' && a.type !== 'video'),
    [assets]
  );

  const docTypes = useMemo(() => {
    const s = new Set(docAssets.map(getDocType));
    return Array.from(s).sort();
  }, [docAssets]);

  const filteredDocs = useMemo(() => {
    if (docTypeFilter === 'all') return docAssets;
    return docAssets.filter((x) => getDocType(x) === docTypeFilter);
  }, [docAssets, docTypeFilter]);

  const groupedDocs = useMemo(() => {
    const map = new Map();
    for (const item of filteredDocs) {
      const key = getDocType(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredDocs]);

  const activeMedia = activeIndex >= 0 ? mediaAssets[activeIndex] : null;

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function startLongPress(id) {
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      setSelectionMode(true);
      toggleSelect(id);
    }, LONG_PRESS_MS);
  }

  function endLongPress() {
    clearLongPress();
  }

  async function loadAll() {
    try {
      setErr('');
      const [u, a] = await Promise.all([
        fetch(`${api}/api/storage/usage`, { credentials: 'include' }),
        fetch(`${api}/api/assets?limit=1000`, { credentials: 'include' }),
      ]);
      if (!u.ok || !a.ok) throw new Error('Chưa đăng nhập hoặc API lỗi');
      const usageData = await u.json();
      const assetsData = await a.json();
      setUsage(usageData);
      setAssets(assetsData.items || []);
    } catch (e) {
      setErr(e.message || 'Không tải được dữ liệu');
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (activeIndex < 0) return;
      if (e.key === 'Escape') setActiveIndex(-1);
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i <= 0 ? mediaAssets.length - 1 : i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i >= mediaAssets.length - 1 ? 0 : i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, mediaAssets.length]);

  async function onUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const form = new FormData();
    files.forEach((f) => form.append('files', f));

    setMsg(`Đang upload ${files.length} file...`);
    try {
      const r = await fetch(`${api}/api/assets/upload`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!r.ok) throw new Error('Upload thất bại');
      const data = await r.json();
      setMsg(`Upload xong: ${data.count} file`);
      await loadAll();
      e.target.value = '';
    } catch (e2) {
      setMsg(`Lỗi upload: ${e2.message || 'unknown'}`);
    }
  }

  function openMedia(id) {
    const idx = mediaAssets.findIndex((x) => x.id === id);
    if (idx >= 0) setActiveIndex(idx);
  }

  function nextMedia() {
    setActiveIndex((i) => (i >= mediaAssets.length - 1 ? 0 : i + 1));
  }

  function prevMedia() {
    setActiveIndex((i) => (i <= 0 ? mediaAssets.length - 1 : i - 1));
  }

  function cardCommonHandlers(item, onClickNormal) {
    return {
      onMouseDown: () => startLongPress(item.id),
      onMouseUp: endLongPress,
      onMouseLeave: endLongPress,
      onTouchStart: () => startLongPress(item.id),
      onTouchEnd: endLongPress,
      onClick: () => {
        if (selectionMode) toggleSelect(item.id);
        else onClickNormal?.();
      },
    };
  }

  return (
    <main style={{ maxWidth: 1260, margin: '20px auto 40px', padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>HC Photos</h2>

      {err && <p style={{ color: '#ff9d9d' }}>{err}</p>}
      {msg && <p style={{ color: '#9bd4ff' }}>{msg}</p>}

      <section style={{ marginBottom: 16, border: '1px solid #2b355a', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <b>Upload nhanh</b>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Kéo-thả sẽ bổ sung sau; hiện có chọn nhiều file</div>
          </div>
          <label style={{ background: '#4f7cff', padding: '10px 14px', borderRadius: 10, cursor: 'pointer' }}>
            Chọn file upload
            <input type="file" multiple onChange={onUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </section>

      {usage && (
        <section style={{ marginBottom: 16, border: '1px solid #2b355a', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>Tổng: <b>{fmtBytes(usage.totalBytes)}</b></div>
            <div>Đã dùng: <b>{fmtBytes(usage.usedBytes)}</b> ({usage.usedPercent}%)</div>
            <div>Còn trống: <b>{fmtBytes(usage.freeBytes)}</b></div>
            <div style={{ height: 16, background: '#223', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, usage.usedPercent)}%`, height: '100%', background: usage.usedPercent >= 90 ? '#ff7a7a' : '#7aa2ff' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', opacity: 0.9 }}>
              <span>Originals: {fmtBytes(usage.breakdown?.originalsBytes || 0)}</span>
              <span>Derived: {fmtBytes(usage.breakdown?.derivedBytes || 0)}</span>
              <span>Trash: {fmtBytes(usage.breakdown?.trashBytes || 0)}</span>
            </div>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            setTab('media');
            setSelectionMode(false);
            setSelectedIds([]);
          }}
          style={{
            border: 0,
            borderRadius: 999,
            padding: '8px 14px',
            background: tab === 'media' ? '#4f7cff' : '#223054',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Ảnh / Video ({mediaAssets.length})
        </button>
        <button
          onClick={() => {
            setTab('docs');
            setSelectionMode(false);
            setSelectedIds([]);
          }}
          style={{
            border: 0,
            borderRadius: 999,
            padding: '8px 14px',
            background: tab === 'docs' ? '#4f7cff' : '#223054',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Tài liệu / file khác ({docAssets.length})
        </button>

        <button
          onClick={() => {
            setSelectionMode((v) => !v);
            if (selectionMode) setSelectedIds([]);
          }}
          style={{ border: '1px solid #3d4f8a', background: 'transparent', color: '#dbe6ff', borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}
        >
          {selectionMode ? 'Thoát chọn nhiều' : 'Bật chọn nhiều'}
        </button>

        {selectionMode && <span style={{ opacity: 0.9 }}>Đã chọn: {selectedIds.length}</span>}
      </section>

      {tab === 'media' && (
        <section style={{ border: '1px solid #2b355a', borderRadius: 12, padding: 14 }}>
          <div style={{ opacity: 0.85, marginBottom: 10 }}>Nhấn giữ để chọn nhiều. Nhấn thường để mở xem trong trang.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {mediaAssets.map((a) => {
              const src = `${api}/api/assets/_media/original/${a.id}`;
              const picked = selectedIds.includes(a.id);

              return (
                <div
                  key={a.id}
                  {...cardCommonHandlers(a, () => openMedia(a.id))}
                  style={{
                    border: picked ? '2px solid #5aa2ff' : '1px solid #2b355a',
                    borderRadius: 10,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    background: '#121a34',
                  }}
                >
                  {a.type === 'image' ? (
                    <img src={src} alt={a.originalName} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <video src={src} style={{ width: '100%', height: 170, objectFit: 'cover', background: '#000' }} muted />
                  )}

                  {picked && (
                    <div style={{ position: 'absolute', top: 8, right: 8, background: '#5aa2ff', color: '#00112a', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '2px 8px' }}>
                      ✓
                    </div>
                  )}

                  <div style={{ padding: 8, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.originalName}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'docs' && (
        <section style={{ border: '1px solid #2b355a', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span>Loại file:</span>
            <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8 }}>
              <option value="all">Tất cả</option>
              {docTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span style={{ opacity: 0.8 }}>Nhấn giữ để chọn nhiều.</span>
          </div>

          {groupedDocs.length === 0 && <p style={{ opacity: 0.8 }}>Chưa có tài liệu.</p>}

          {groupedDocs.map(([group, items]) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 700 }}>{group} ({items.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {items.map((a) => {
                  const src = `${api}/api/assets/_media/original/${a.id}`;
                  const picked = selectedIds.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      {...cardCommonHandlers(a, () => window.open(src, '_blank'))}
                      style={{
                        border: picked ? '2px solid #5aa2ff' : '1px solid #2b355a',
                        borderRadius: 10,
                        padding: 10,
                        cursor: 'pointer',
                        background: '#121a34',
                        position: 'relative',
                      }}
                    >
                      {picked && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: '#5aa2ff', color: '#00112a', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '2px 8px' }}>
                          ✓
                        </div>
                      )}
                      <div style={{ fontWeight: 700, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.originalName}</div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>{fmtBytes(a.size)}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{a.mime || 'unknown-mime'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {activeMedia && (
        <div
          onClick={() => setActiveIndex(-1)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.86)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); prevMedia(); }}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'rgba(255,255,255,0.15)', color: 'white', width: 46, height: 46, borderRadius: '50%', fontSize: 24, cursor: 'pointer' }}
            aria-label="Prev"
          >
            ‹
          </button>

          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '86vh', width: '100%', textAlign: 'center' }}>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>{activeMedia.originalName}</div>
            {activeMedia.type === 'image' ? (
              <img
                src={`${api}/api/assets/_media/original/${activeMedia.id}`}
                alt={activeMedia.originalName}
                style={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain' }}
              />
            ) : (
              <video
                src={`${api}/api/assets/_media/original/${activeMedia.id}`}
                controls
                autoPlay
                style={{ maxWidth: '90vw', maxHeight: '78vh', background: '#000' }}
              />
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); nextMedia(); }}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'rgba(255,255,255,0.15)', color: 'white', width: 46, height: 46, borderRadius: '50%', fontSize: 24, cursor: 'pointer' }}
            aria-label="Next"
          >
            ›
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); setActiveIndex(-1); }}
            style={{ position: 'absolute', top: 18, right: 18, border: 0, background: 'rgba(255,255,255,0.15)', color: 'white', width: 42, height: 42, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}
