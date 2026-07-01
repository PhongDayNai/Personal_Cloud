'use client';
// Refactored DashboardPage

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import SettingsModal from '../../components/SettingsModal';

import { Asset, User, Album, Tag, DocProject } from '../../types';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import AssetGrid from '../../components/AssetGrid';
import DocView from '../../components/DocView';
import MediaViewer from '../../components/MediaViewer';

import {
  getApiOrigin,
  fmtBytes,
  docTypeOf,
  docCategoryOf,
  DOC_CATEGORY_LABELS,
  monthLabel,
  yearLabel,
  inferUploadKind,
  readErrorMessage
} from '../../lib/utils';

const LONG_PRESS_MS = 420;
import SmartVideo from '../../components/SmartVideo';

export default function DashboardPage(): React.JSX.Element {
  const { language, setLanguage, t } = useLanguage();
  const api = useMemo(() => getApiOrigin(), []);

  const [usage, setUsage] = useState<any>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  const [tab, setTab] = useState<'photos' | 'docs'>('photos');
  const [search, setSearch] = useState<string>('');

  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showAlbumPicker, setShowAlbumPicker] = useState<boolean>(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumQuery, setAlbumQuery] = useState<string>('');
  const [selectedAlbumsForActive, setSelectedAlbumsForActive] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [selectedTagsForActive, setSelectedTagsForActive] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState<boolean>(false);
  const [tagQuery, setTagQuery] = useState<string>('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('all');
  const [docCollectionView, setDocCollectionView] = useState<'all' | 'trash'>('all');
  const [docKindsExpanded, setDocKindsExpanded] = useState<boolean>(false);
  const [collectionView, setCollectionView] = useState<'all' | 'recent' | 'images' | 'videos' | 'trash'>('all');
  const [albumsExpanded, setAlbumsExpanded] = useState<boolean>(false);
  const [docProjects, setDocProjects] = useState<DocProject[]>([]);
  const [docProjectsExpanded, setDocProjectsExpanded] = useState<boolean>(false);
  const [selectedDocProject, setSelectedDocProject] = useState<string>('all');
  const [groupByTimeEnabled, setGroupByTimeEnabled] = useState<boolean>(false);
  const [groupMode, setGroupMode] = useState<'month' | 'year'>('month');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeMediaFit, setActiveMediaFit] = useState<'contain-wide' | 'contain-tall'>('contain-wide');

  // State và Handler cho đổi mật khẩu & logout phiên khác (Phase 1)
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  async function handleLogout() {
    try {
      await fetch(`${api}/api/auth/logout`, { method: 'POST', credentials: 'include' });
      window.location.href = '/login';
    } catch (e) {
      setErr(t('messages.logoutFailed'));
    }
  }

  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const suppressClickRef = useRef<string | null>(null);

  const filteredAssets = useMemo(() => {
    let list = assets;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => (a.originalName || '').toLowerCase().includes(q) || (a.tags || []).some(t => t.toLowerCase().includes(q)));
    }
    if (selectedFilterTags.length > 0) {
      list = list.filter((a) => selectedFilterTags.every((t) => (a.tags || []).includes(t)));
    }
    return list;
  }, [assets, search, selectedFilterTags]);

  const basePhotoAssets = useMemo(
    () => filteredAssets.filter((a) => a.type === 'image' || a.type === 'video'),
    [filteredAssets]
  );

  const recentCutoff = useMemo(() => Date.now() - 14 * 24 * 60 * 60 * 1000, []);

  const photoAssets = useMemo(() => {
    const activePhotos = basePhotoAssets.filter((a) => !a.isDeleted);
    const trashedPhotos = basePhotoAssets.filter((a) => a.isDeleted);

    if (collectionView === 'recent') {
      return activePhotos.filter((a) => new Date(a.uploadedAt || 0).getTime() >= recentCutoff);
    }
    if (collectionView === 'images') return activePhotos.filter((a) => a.type === 'image');
    if (collectionView === 'videos') return activePhotos.filter((a) => a.type === 'video');
    if (collectionView === 'trash') return trashedPhotos;
    return activePhotos;
  }, [basePhotoAssets, collectionView, recentCutoff]);

  const docs = useMemo(
    () => filteredAssets.filter((a) => a.type !== 'image' && a.type !== 'video' && !a.isDeleted),
    [filteredAssets]
  );

  const trashedDocs = useMemo(
    () => filteredAssets.filter((a) => a.type !== 'image' && a.type !== 'video' && a.isDeleted),
    [filteredAssets]
  );

  const docsBase = useMemo(() => (docCollectionView === 'trash' ? trashedDocs : docs), [docCollectionView, docs, trashedDocs]);

  const docTypes = useMemo(() => Array.from(new Set(docsBase.map(docTypeOf))).sort(), [docsBase]);

  const docsFiltered = useMemo(() => {
    let list = docsBase;
    if (selectedDocProject !== 'all') {
      list = list.filter((d) => (d.docProjectNames || []).includes(selectedDocProject) || d.docProjectName === selectedDocProject);
    }
    if (docCategoryFilter !== 'all') list = list.filter((d) => docCategoryOf(d) === docCategoryFilter);
    if (docTypeFilter !== 'all') list = list.filter((d) => docTypeOf(d) === docTypeFilter);
    return list;
  }, [docsBase, selectedDocProject, docCategoryFilter, docTypeFilter]);

  const docCategoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docsBase) {
      const c = docCategoryOf(d);
      m.set(c, (m.get(c) || 0) + 1);
    }
    return m;
  }, [docsBase]);

  const docsGrouped = useMemo(() => {
    const m = new Map<string, Asset[]>();
    for (const d of docsFiltered) {
      const key = DOC_CATEGORY_LABELS[docCategoryOf(d)] || 'Khác';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [docsFiltered]);

  const [selectedAlbum, setSelectedAlbum] = useState<string>('all');

  const availableAlbums = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of photoAssets) {
      if (!p.albumName) continue;
      m.set(p.albumName, (m.get(p.albumName) || 0) + 1);
    }
    return Array.from(m.entries());
  }, [photoAssets]);

  const albumFilteredPhotos = useMemo(() => {
    if (selectedAlbum === 'all') return photoAssets;
    return photoAssets.filter((p) => p.albumName === selectedAlbum);
  }, [photoAssets, selectedAlbum]);

  const photoGroups = useMemo<[string, Asset[]][]>(() => {
    if (!groupByTimeEnabled) return [['all', albumFilteredPhotos]];
    const m = new Map<string, Asset[]>();
    for (const p of albumFilteredPhotos) {
      const key = groupMode === 'year' ? yearLabel(p.takenAt || p.uploadedAt) : monthLabel(p.takenAt || p.uploadedAt, language);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return Array.from(m.entries());
  }, [albumFilteredPhotos, groupMode, groupByTimeEnabled, language]);

  const activeIndexInScope = activeIndex >= 0;
  const active = activeIndexInScope
    ? (tab === 'photos' ? albumFilteredPhotos[activeIndex] : docsFiltered[activeIndex])
    : null;

  useEffect(() => {
    if (!active) return;
    if (active.type === 'image') {
      const src = `${api}/api/assets/_media/original/${active.id}`;
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        setActiveMediaFit(h > w ? 'contain-tall' : 'contain-wide');
      };
      img.src = src;
    } else {
      setActiveMediaFit('contain-wide');
    }
  }, [active?.id, active?.type, api]);


  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function togglePick(id: string) {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length === 0) setSelectionMode(false);
      return next;
    });
  }

  function beginLongPress(id: string) {
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      suppressClickRef.current = id;
      setSelectionMode(true);
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }, LONG_PRESS_MS);
  }

  function endLongPress() {
    clearLongPress();
  }

  async function loadData() {
    try {
      setErr('');

      const me = await fetch(`${api}/api/auth/me`, { credentials: 'include' });
      if (!me.ok) {
        window.location.href = '/login';
        return;
      }
      const meData = await me.json();
      setUser(meData?.user);
      if (meData?.user?.mustChangePassword) {
        setMustChangePassword(true);
        setShowSettingsModal(true);
      }

      const [usageRes, assetsRes, projectsRes, tagsRes] = await Promise.all([
        fetch(`${api}/api/storage/usage`, { credentials: 'include' }),
        fetch(`${api}/api/assets?limit=1500&includeTrash=true`, { credentials: 'include' }),
        fetch(`${api}/api/assets/doc-projects`, { credentials: 'include' }),
        fetch(`${api}/api/assets/tags`, { credentials: 'include' }),
      ]);
      if (!usageRes.ok || !assetsRes.ok || !projectsRes.ok || !tagsRes.ok) throw new Error(t('messages.apiErrorOrSessionExpired'));
      const usageData = await usageRes.json();
      const assetsData = await assetsRes.json();
      const projectsData = await projectsRes.json();
      const tagsData = await tagsRes.json();
      setUsage(usageData);
      setAssets(assetsData.items || []);
      setDocProjects(projectsData.items || []);
      setTags(tagsData.items || []);
    } catch (e: any) {
      setErr(e.message || t('messages.loadDataFailed'));
    }
  }

  useEffect(() => {
    loadData();
    loadAlbums();
  }, []);

  useEffect(() => {
    const hasProcessing = assets.some((a) => a.type === 'video' && a.processingStatus === 'processing');
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(timer);
  }, [assets, api]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handleGlobalClick = () => setShowProfileMenu(false);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [showProfileMenu]);



  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (activeIndex < 0) return;
      if (e.key === 'Escape') {
        setActiveIndex(-1);
        setShowInfo(false);
        setShowAlbumPicker(false);
        setShowTagPicker(false);
      }
      const list = tab === 'photos' ? albumFilteredPhotos : docsFiltered;
      if (list.length === 0) return;
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i <= 0 ? list.length - 1 : i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i >= list.length - 1 ? 0 : i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, albumFilteredPhotos.length, docsFiltered.length, tab]);

  async function uploadLargeFileByChunks(file: File, translateFn: (key: string, replacements?: Record<string, string | number>) => string) {
    const init = await fetch(`${api}/api/assets/upload-chunk/init`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, mime: file.type || 'application/octet-stream', totalSize: file.size, lastModified: file.lastModified }),
    });
    if (!init.ok) {
      const detail = await readErrorMessage(init, translateFn);
      throw new Error(translateFn('messages.chunkUploadInitFailed', { status: init.status, detail }));
    }
    const initData = await init.json();
    const uploadId = initData.uploadId;

    const CHUNK = 8 * 1024 * 1024; // 8MB/chunk
    const totalChunks = Math.ceil(file.size / CHUNK);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK;
      const end = Math.min(file.size, start + CHUNK);
      const blob = file.slice(start, end);
      const fd = new FormData();
      fd.append('chunk', blob, `${file.name}.part`);
      fd.append('index', String(i));

      const r = await fetch(`${api}/api/assets/upload-chunk/${uploadId}`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!r.ok) {
        const detail = await readErrorMessage(r, translateFn);
        throw new Error(translateFn('messages.chunkUploadPartFailed', { index: i + 1, total: totalChunks, status: r.status, detail }));
      }
    }

    const done = await fetch(`${api}/api/assets/upload-chunk/${uploadId}/complete`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!done.ok) {
      const detail = await readErrorMessage(done, translateFn);
      throw new Error(translateFn('messages.chunkUploadCompleteFailed', { status: done.status, detail }));
    }
    return done.json();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const failed = [];
    let done = 0;

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      const kindCode = inferUploadKind(file);
      const kind = kindCode === 'image' ? t('messages.kindImage') : kindCode === 'video' ? t('messages.kindVideo') : t('messages.kindDoc');
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      const big = file.size > 90 * 1024 * 1024; // >90MB dùng chunk tránh Cloudflare limit

      try {
        setMsg(t('messages.uploadingDetail', {
          done,
          total: files.length,
          index: idx + 1,
          name: file.name,
          kind,
          size: sizeMb,
          mode: big ? t('messages.uploadModeChunk') : t('messages.uploadModeNormal')
        }));

        if (big) {
          await uploadLargeFileByChunks(file, t);
        } else {
          const form = new FormData();
          form.append('files', file);
          form.append('lastModified', String(file.lastModified));
          const r = await fetch(`${api}/api/assets/upload`, {
            method: 'POST',
            credentials: 'include',
            body: form,
          });
          if (!r.ok) {
            const detail = await readErrorMessage(r, t);
            throw new Error(`Upload failed (HTTP ${r.status}): ${detail}`);
          }
          await r.json();
        }

        done += 1;
        setMsg(t('messages.uploadSuccessDetail', { name: file.name, kind, done, total: files.length }));
      } catch (ex: any) {
        const reason = ex?.message || 'unknown';
        failed.push({ index: idx + 1, name: file.name, kind, sizeMb, mode: big ? t('messages.uploadModeChunk') : t('messages.uploadModeNormal'), reason });
        setMsg(t('messages.uploadErrorDetail', { index: idx + 1, total: files.length, name: file.name, kind, reason }));
      }
    }

    await loadData();
    e.target.value = '';

    if (failed.length === 0) {
      setMsg(t('messages.uploadDone', { done, total: files.length }));
      return;
    }

    const lines = failed.map((f) => `- #${f.index} ${f.name} | ${f.kind} | ${f.sizeMb}MB | ${f.mode} | ${f.reason}`);
    setErr(`${t('messages.uploadHasErrors', { failed: failed.length, total: files.length })}:\n${lines.join('\n')}`);
    setMsg(t('messages.uploadDoneWithErrors', { done, total: files.length, failed: failed.length }));
  }

  async function moveSelectedToTrash() {
    if (!selectedIds.length) return;
    try {
      const r = await fetch(`${api}/api/assets/bulk/trash`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!r.ok) throw new Error(t('messages.deleteFailed'));
      const data = await r.json();
      setMsg(t('messages.trashedCount', { count: data.updated || 0 }));
      setSelectedIds([]);
      setSelectionMode(false);
      await loadData();
    } catch (e: any) {
      setMsg(t('messages.deleteError', { error: e.message || 'unknown' }));
    }
  }

  async function restoreSelectedFromTrash() {
    if (!selectedIds.length) return;
    try {
      const r = await fetch(`${api}/api/assets/bulk/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!r.ok) throw new Error(t('messages.restoreFailed'));
      const data = await r.json();
      setMsg(t('messages.restoredCount', { count: data.updated || 0 }));
      setSelectedIds([]);
      setSelectionMode(false);
      await loadData();
    } catch (e: any) {
      setMsg(t('messages.restoreError', { error: e.message || 'unknown' }));
    }
  }

  async function purgeSelectedForever() {
    if (!selectedIds.length) return;
    const ok = window.confirm(t('dialogs.deleteForeverConfirm', { count: selectedIds.length }));
    if (!ok) return;

    try {
      const r = await fetch(`${api}/api/assets/bulk/purge`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!r.ok) throw new Error(t('messages.purgeFailed'));
      const data = await r.json();
      setMsg(t('messages.purgedCount', { count: data.removed || 0 }));
      setSelectedIds([]);
      setSelectionMode(false);
      await loadData();
    } catch (e: any) {
      setMsg(t('messages.purgeError', { error: e.message || 'unknown' }));
    }
  }

  async function addSelectedToAlbum() {
    if (!selectedIds.length) return;
    const name = window.prompt(t('viewer.newAlbumPrompt'));
    if (!name || !name.trim()) return;

    try {
      const r = await fetch(`${api}/api/assets/bulk/album`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, albumName: name.trim() }),
      });
      if (!r.ok) throw new Error(t('messages.albumAddFailed'));
      const data = await r.json();
      setMsg(t('messages.addedToAlbumCount', { count: data.updated || 0, name: name.trim() }));
      await loadData();
    } catch (e: any) {
      setMsg(t('messages.albumError', { error: e.message || 'unknown' }));
    }
  }

  async function addSelectedToDocProject() {
    if (!selectedIds.length) return;
    const name = window.prompt(t('messages.projectPrompt'));
    if (!name || !name.trim()) return;

    try {
      const r = await fetch(`${api}/api/assets/bulk/doc-project`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, projectName: name.trim() }),
      });
      if (!r.ok) throw new Error(t('messages.projectAddFailed'));
      const data = await r.json();
      setMsg(t('messages.addedToProjectCount', { count: data.updated || 0, name: name.trim() }));
      await loadData();
      await loadDocProjects();
    } catch (e: any) {
      setMsg(t('messages.projectError', { error: e.message || 'unknown' }));
    }
  }

  async function loadAlbums() {
    try {
      const r = await fetch(`${api}/api/assets/albums`, { credentials: 'include' });
      if (!r.ok) throw new Error(t('viewer.errorLoadAlbum'));
      const data = await r.json();
      setAlbums(data.items || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDocProjects() {
    try {
      const r = await fetch(`${api}/api/assets/doc-projects`, { credentials: 'include' });
      if (!r.ok) throw new Error(t('viewer.errorLoadDocProjects'));
      const data = await r.json();
      setDocProjects(data.items || []);
    } catch (err) {
      console.error(err);
    }
  }

  function toggleAlbumSelection(name: string) {
    setSelectedAlbumsForActive((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }

  function createNewAlbumInSelection(name: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setSelectedAlbumsForActive((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    );
    setAlbums((prev) => {
      if (prev.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      return [...prev, { name: trimmed, count: 0 }];
    });
  }

  async function saveActiveAlbums() {
    if (!active?.id) return;
    try {
      const r = await fetch(`${api}/api/assets/${active.id}/albums`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumNames: selectedAlbumsForActive }),
      });
      if (!r.ok) throw new Error(t('viewer.albumUpdateFailed'));
      await loadData();
      await loadAlbums();
      setShowAlbumPicker(false);
      setMsg(t('viewer.albumUpdateSuccess'));
    } catch (e: any) {
      setMsg(t('viewer.albumSaveError', { error: e.message }));
    }
  }

  async function loadTags() {
    try {
      const r = await fetch(`${api}/api/assets/tags`, { credentials: 'include' });
      if (!r.ok) throw new Error(t('viewer.tagsLoadFailed'));
      const data = await r.json();
      setTags(data.items || []);
    } catch (e) {
      console.error(e);
    }
  }

  function toggleTagSelection(name: string) {
    setSelectedTagsForActive((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }

  function createNewTagInSelection(name: string) {
    const trimmed = (name || '').trim().toLowerCase();
    if (!trimmed) return;
    setSelectedTagsForActive((prev) =>
      prev.includes(trimmed) ? prev : [...prev, trimmed]
    );
    setTags((prev) => {
      if (prev.some((tVal) => tVal.name.toLowerCase() === trimmed)) return prev;
      return [...prev, { name: trimmed, count: 0 }];
    });
  }

  async function saveActiveTags() {
    if (!active?.id) return;
    try {
      const r = await fetch(`${api}/api/assets/${active.id}/tags`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: selectedTagsForActive }),
      });
      if (!r.ok) throw new Error(t('viewer.tagsUpdateFailed'));
      await loadData();
      await loadTags();
      setShowTagPicker(false);
      setMsg(t('viewer.tagsUpdateSuccess'));
    } catch (e: any) {
      setMsg(t('viewer.tagsSaveError', { error: e.message }));
    }
  }

  function toggleFilterTag(name: string) {
    setSelectedFilterTags((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }


  function openPhoto(id: string) {
    const idx = albumFilteredPhotos.findIndex((x) => x.id === id);
    if (idx >= 0) setActiveIndex(idx);
  }

  function openDoc(id: string) {
    const idx = docsFiltered.findIndex((x) => x.id === id);
    if (idx >= 0) setActiveIndex(idx);
  }

  function cardHandlers(item: Asset, onNormalClick?: () => void) {
    return {
      onMouseDown: () => beginLongPress(item.id),
      onMouseUp: endLongPress,
      onMouseLeave: endLongPress,
      onTouchStart: () => beginLongPress(item.id),
      onTouchEnd: endLongPress,
      onClick: () => {
        if (suppressClickRef.current === item.id) {
          suppressClickRef.current = null;
          return;
        }
        if (selectionMode) togglePick(item.id);
        else onNormalClick?.();
      },
    };
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  return (
    <div className="shell">
      <Sidebar
        tab={tab}
        setTab={setTab}
        collectionView={collectionView}
        setCollectionView={setCollectionView}
        selectedAlbum={selectedAlbum}
        setSelectedAlbum={setSelectedAlbum}
        setSelectionMode={setSelectionMode}
        setSelectedIds={setSelectedIds}
        basePhotoAssets={basePhotoAssets}
        docs={docs}
        trashedDocs={trashedDocs}
        docCollectionView={docCollectionView}
        setDocCollectionView={setDocCollectionView}
        docCategoryFilter={docCategoryFilter}
        setDocCategoryFilter={setDocCategoryFilter}
        setSelectedDocProject={setSelectedDocProject}
        albumsExpanded={albumsExpanded}
        setAlbumsExpanded={setAlbumsExpanded}
        availableAlbums={availableAlbums}
        docProjectsExpanded={docProjectsExpanded}
        setDocProjectsExpanded={setDocProjectsExpanded}
        selectedDocProject={selectedDocProject}
        docProjects={docProjects}
        docsBase={docsBase}
        docCategoryCounts={docCategoryCounts}
        docKindsExpanded={docKindsExpanded}
        setDocKindsExpanded={setDocKindsExpanded}
        docTypes={docTypes}
        docTypeFilter={docTypeFilter}
        setDocTypeFilter={setDocTypeFilter}
        tags={tags}
        selectedFilterTags={selectedFilterTags}
        toggleFilterTag={toggleFilterTag}
        setSelectedFilterTags={setSelectedFilterTags}
        usage={usage}
        showProfileMenu={showProfileMenu}
        setShowProfileMenu={setShowProfileMenu}
        user={user}
        setShowSettingsModal={setShowSettingsModal}
        handleLogout={handleLogout}
        t={t}
      />

      <main className="main">
        <Topbar
          search={search}
          setSearch={setSearch}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          tab={tab}
          collectionView={collectionView}
          docCollectionView={docCollectionView}
          onUpload={onUpload}
          addSelectedToAlbum={addSelectedToAlbum}
          addSelectedToDocProject={addSelectedToDocProject}
          moveSelectedToTrash={moveSelectedToTrash}
          restoreSelectedFromTrash={restoreSelectedFromTrash}
          purgeSelectedForever={purgeSelectedForever}
          t={t}
        />

        {msg && <div className="info">{msg}</div>}
        {err && <div className="error">{err}</div>}

        {tab === 'photos' && (
          <AssetGrid
            groupByTimeEnabled={groupByTimeEnabled}
            setGroupByTimeEnabled={setGroupByTimeEnabled}
            groupMode={groupMode}
            setGroupMode={setGroupMode}
            collectionView={collectionView}
            photoGroups={photoGroups}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            selectedIds={selectedIds}
            api={api}
            cardHandlers={cardHandlers}
            openPhoto={openPhoto}
            t={t}
          />
        )}

        {tab === 'docs' && (
          <DocView
            docTypeFilter={docTypeFilter}
            setDocTypeFilter={setDocTypeFilter}
            docTypes={docTypes}
            selectedDocProject={selectedDocProject}
            docCollectionView={docCollectionView}
            docsGrouped={docsGrouped}
            selectedIds={selectedIds}
            cardHandlers={cardHandlers}
            openDoc={openDoc}
            t={t}
          />
        )}
      </main>

      <MediaViewer
        active={active}
        tab={tab}
        albumFilteredPhotos={albumFilteredPhotos}
        docsFiltered={docsFiltered}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        showInfo={showInfo}
        setShowInfo={setShowInfo}
        showAlbumPicker={showAlbumPicker}
        setShowAlbumPicker={setShowAlbumPicker}
        showTagPicker={showTagPicker}
        setShowTagPicker={setShowTagPicker}
        activeMediaFit={activeMediaFit}
        setActiveMediaFit={setActiveMediaFit}
        albumQuery={albumQuery}
        setAlbumQuery={setAlbumQuery}
        tagQuery={tagQuery}
        setTagQuery={setTagQuery}
        albums={albums}
        tags={tags}
        selectedAlbumsForActive={selectedAlbumsForActive}
        selectedTagsForActive={selectedTagsForActive}
        toggleAlbumSelection={toggleAlbumSelection}
        toggleTagSelection={toggleTagSelection}
        saveActiveAlbums={saveActiveAlbums}
        saveActiveTags={saveActiveTags}
        createNewAlbumInSelection={createNewAlbumInSelection}
        createNewTagInSelection={createNewTagInSelection}
        loadAlbums={loadAlbums}
        loadTags={loadTags}
        setMsg={setMsg}
        api={api}
        t={t}
      />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        user={user}
        setUser={setUser}
        mustChangePassword={mustChangePassword}
        setMustChangePassword={setMustChangePassword}
        setMsg={setMsg}
        setErr={setErr}
        api={api}
      />

      <style jsx>{`
        /* An spin-button (mui ten tang giam) cua input type="number" */
        :global(input::-webkit-outer-spin-button),
        :global(input::-webkit-inner-spin-button) {
          -webkit-appearance: none;
          margin: 0;
        }
        :global(input[type="number"]) {
          -moz-appearance: textfield;
        }

        .shell {
          display: grid;
          grid-template-columns: 260px 1fr;
          min-height: 100vh;
          background: var(--bg-page);
          color: var(--text-primary);
          transition: background 0.25s ease, color 0.25s ease;
        }
        .tableRowHover:hover {
          background: var(--bg-item-hover);
        }
        .main {
          padding: 24px 32px 40px;
          box-sizing: border-box;
          overflow-y: auto;
        }

        .info {
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.05);
          border: 1px solid rgba(96, 165, 250, 0.1);
          padding: 10px 14px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .error {
          color: #f87171;
          background: rgba(248, 113, 113, 0.05);
          border: 1px solid rgba(248, 113, 113, 0.1);
          padding: 10px 14px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 13px;
          white-space: pre-line;
        }
        @media (max-width: 900px) {
          .shell { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
