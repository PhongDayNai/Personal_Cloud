'use client';
// Refactored DashboardPage

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import SettingsModal from '../../components/SettingsModal';
import CreateSpaceModal from '../../components/CreateSpaceModal';

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
  readErrorMessage,
  docIconOf
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

  const [tab, setTab] = useState<'photos' | 'docs' | 'all' | 'space' | 'spaces'>('photos');
  const [search, setSearch] = useState<string>('');

  const [activeWorkspace, setActiveWorkspace] = useState<{ type: 'personal' } | { type: 'space'; id: string; name: string; spaceType: string }>({ type: 'personal' });
  const [spaces, setSpaces] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [postCaption, setPostCaption] = useState<string>('');
  const [postFiles, setPostFiles] = useState<File[]>([]);

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
  const [docCollectionView, setDocCollectionView] = useState<'all' | 'recent' | 'trash'>('all');
  const [allFilesCollectionView, setAllFilesCollectionView] = useState<'all' | 'recent' | 'trash'>('all');
  const [docKindsExpanded, setDocKindsExpanded] = useState<boolean>(false);
  const [collectionView, setCollectionView] = useState<'all' | 'recent' | 'images' | 'videos' | 'trash'>('all');
  const [albumsExpanded, setAlbumsExpanded] = useState<boolean>(false);
  const [docProjects, setDocProjects] = useState<DocProject[]>([]);
  const [docProjectsExpanded, setDocProjectsExpanded] = useState<boolean>(false);
  const [selectedDocProject, setSelectedDocProject] = useState<string>('all');
  const [groupByTimeEnabled, setGroupByTimeEnabled] = useState<boolean>(true);
  const [groupMode, setGroupMode] = useState<'month' | 'year'>('month');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [activeMediaFit, setActiveMediaFit] = useState<'contain-wide' | 'contain-tall'>('contain-wide');

  // State và Handler cho đổi mật khẩu & logout phiên khác (Phase 1)
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState<boolean>(false);

  async function handleLogout() {
    try {
      await fetch(`${api}/api/auth/logout`, { method: 'POST', credentials: 'include' });
      window.location.href = '/login';
    } catch (e) {
      setErr(t('messages.logoutFailed'));
    }
  }

  async function handleCreateSpace(name: string, type: 'journal' | 'collection' | 'project', description: string): Promise<boolean> {
    try {
      setMsg("Đang tạo không gian con...");
      const r = await fetch(`${api}/api/spaces`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type: type.toLowerCase(), description: description.trim() }),
      });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(errorData.message || "Tạo không gian thất bại");
      }
      const data = await r.json();
      setSpaces(prev => [data.space, ...prev]);
      setMsg("Đã tạo không gian con thành công!");
      return true;
    } catch (e: any) {
      setErr(e.message || "Lỗi tạo không gian");
      throw e;
    }
  }

  async function handleCreatePost() {
    if (!postCaption.trim() && postFiles.length === 0) return;
    try {
      setMsg("Đang đăng bài viết...");
      const fd = new FormData();
      fd.append('caption', postCaption.trim());
      for (const f of postFiles) {
        fd.append('files', f);
      }
      const r = await fetch(`${api}/api/spaces/${(activeWorkspace as any).id}/posts`, {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      if (!r.ok) throw new Error("Đăng bài thất bại");
      const data = await r.json();
      setPosts(prev => [data.post, ...prev]);
      setPostCaption('');
      setPostFiles([]);
      setMsg("Đăng bài viết thành công!");
      await loadData();
    } catch (e: any) {
      setErr(e.message || "Lỗi đăng bài");
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

  const docsBase = useMemo(() => {
    if (docCollectionView === 'trash') return trashedDocs;
    if (docCollectionView === 'recent') {
      return docs.filter((d) => new Date(d.uploadedAt || 0).getTime() >= recentCutoff);
    }
    return docs;
  }, [docCollectionView, docs, trashedDocs, recentCutoff]);

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

  const allActiveAssets = useMemo(() => {
    if (allFilesCollectionView === 'trash') {
      return filteredAssets.filter((a) => a.isDeleted);
    }
    const active = filteredAssets.filter((a) => !a.isDeleted);
    if (allFilesCollectionView === 'recent') {
      return active.filter((a) => new Date(a.uploadedAt || 0).getTime() >= recentCutoff);
    }
    return active;
  }, [filteredAssets, allFilesCollectionView, recentCutoff]);

  const allActiveAssetsGrouped = useMemo(() => {
    const m = new Map<string, Asset[]>();
    for (const d of allActiveAssets) {
      let key = 'Khác';
      if (d.type === 'image' || d.type === 'video') {
        key = 'Ảnh & Video';
      } else {
        key = DOC_CATEGORY_LABELS[docCategoryOf(d)] || 'Tài liệu khác';
      }
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return Array.from(m.entries()).sort((a, b) => {
      if (a[0] === 'Ảnh & Video') return -1;
      if (b[0] === 'Ảnh & Video') return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [allActiveAssets]);

  const spaceAssets = useMemo(() => {
    const list: Asset[] = [];
    for (const post of posts) {
      if (post.assets) {
        list.push(...post.assets);
      }
    }
    return list;
  }, [posts]);

  const spaceAssetsGrouped = useMemo(() => {
    const m = new Map<string, Asset[]>();
    for (const d of spaceAssets) {
      let key = 'Khác';
      if (d.type === 'image' || d.type === 'video') {
        key = 'Ảnh & Video';
      } else {
        key = DOC_CATEGORY_LABELS[docCategoryOf(d)] || 'Tài liệu khác';
      }
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return Array.from(m.entries()).sort((a, b) => {
      if (a[0] === 'Ảnh & Video') return -1;
      if (b[0] === 'Ảnh & Video') return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [spaceAssets]);

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
    ? (tab === 'photos' 
        ? albumFilteredPhotos[activeIndex] 
        : tab === 'all'
          ? allActiveAssets[activeIndex]
          : tab === 'space'
            ? spaceAssets[activeIndex]
            : docsFiltered[activeIndex])
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

      const [usageRes, assetsRes, projectsRes, tagsRes, spacesRes] = await Promise.all([
        fetch(`${api}/api/storage/usage`, { credentials: 'include' }),
        fetch(`${api}/api/assets?limit=1500&includeTrash=true`, { credentials: 'include' }),
        fetch(`${api}/api/assets/doc-projects`, { credentials: 'include' }),
        fetch(`${api}/api/assets/tags`, { credentials: 'include' }),
        fetch(`${api}/api/spaces`, { credentials: 'include' }),
      ]);
      if (!usageRes.ok || !assetsRes.ok || !projectsRes.ok || !tagsRes.ok || !spacesRes.ok) throw new Error(t('messages.apiErrorOrSessionExpired'));
      const usageData = await usageRes.json();
      const assetsData = await assetsRes.json();
      const projectsData = await projectsRes.json();
      const tagsData = await tagsRes.json();
      const spacesData = await spacesRes.json();
      setUsage(usageData);
      setAssets(assetsData.items || []);
      setDocProjects(projectsData.items || []);
      setTags(tagsData.items || []);
      setSpaces(spacesData.spaces || []);

      if (activeWorkspace.type === 'space') {
        const postsRes = await fetch(`${api}/api/spaces/${activeWorkspace.id}/posts`, { credentials: 'include' });
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(postsData.posts || []);
        }
      }
    } catch (e: any) {
      setErr(e.message || t('messages.loadDataFailed'));
    }
  }

  useEffect(() => {
    loadData();
    loadAlbums();
  }, [activeWorkspace]);

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
      const list = tab === 'photos' 
        ? albumFilteredPhotos 
        : tab === 'all' 
          ? allActiveAssets 
          : tab === 'space' 
            ? spaceAssets 
            : docsFiltered;
      if (list.length === 0) return;
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i <= 0 ? list.length - 1 : i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i >= list.length - 1 ? 0 : i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, albumFilteredPhotos.length, docsFiltered.length, allActiveAssets.length, spaceAssets.length, tab]);

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

  function openAll(id: string) {
    const idx = allActiveAssets.findIndex((x) => x.id === id);
    if (idx >= 0) setActiveIndex(idx);
  }

  function openSpaceAsset(id: string) {
    const idx = spaceAssets.findIndex((x) => x.id === id);
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
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
        spaces={spaces}
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
          <>
            <div className="pageHeader">
              <h1>{t('sidebar.allPhotosVideos') || 'Thư viện ảnh & video'}</h1>
              <p>{t('photos.subtitle') || 'Không gian lưu trữ hình ảnh và thước phim kỷ niệm sinh động của bạn.'}</p>
            </div>
            <div className="viewTabs">
              <button 
                className={`tabBtn ${collectionView === 'all' ? 'active' : ''}`}
                onClick={() => setCollectionView('all')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {t('sidebar.allPhotosVideos') || 'Tất cả ảnh/video'}
              </button>
              <button 
                className={`tabBtn ${collectionView === 'recent' ? 'active' : ''}`}
                onClick={() => setCollectionView('recent')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {t('sidebar.recentlyAdded') || 'Mới thêm'}
              </button>
              <button 
                className={`tabBtn ${collectionView === 'images' ? 'active' : ''}`}
                onClick={() => setCollectionView('images')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {t('sidebar.imagesOnly') || 'Ảnh'}
              </button>
              <button 
                className={`tabBtn ${collectionView === 'videos' ? 'active' : ''}`}
                onClick={() => setCollectionView('videos')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="2" y1="7" x2="7" y2="7" />
                  <line x1="2" y1="17" x2="7" y2="17" />
                  <line x1="17" y1="17" x2="22" y2="17" />
                  <line x1="17" y1="7" x2="22" y2="7" />
                </svg>
                {t('sidebar.videosOnly') || 'Video'}
              </button>
              <button 
                className={`tabBtn ${collectionView === 'trash' ? 'active' : ''}`}
                onClick={() => setCollectionView('trash')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                {t('sidebar.trashBin') || 'Thùng rác'}
              </button>
            </div>

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
          </>
        )}

        {tab === 'docs' && (
          <>
            <div className="pageHeader">
              <h1>{t('sidebar.documents') || 'Tài liệu cá nhân'}</h1>
              <p>{t('docs.subtitle') || 'Lưu trữ, đọc và sắp xếp các văn bản, bảng tính, tệp PDF của bạn.'}</p>
            </div>
            <DocView
              docTypeFilter={docTypeFilter}
              setDocTypeFilter={setDocTypeFilter}
              docTypes={docTypes}
              selectedDocProject={selectedDocProject}
              docCollectionView={docCollectionView}
              setDocCollectionView={setDocCollectionView}
              docCategoryFilter={docCategoryFilter}
              setDocCategoryFilter={setDocCategoryFilter}
              docsGrouped={docsGrouped}
              selectedIds={selectedIds}
              cardHandlers={cardHandlers}
              openDoc={openDoc}
              t={t}
              groupByTimeEnabled={groupByTimeEnabled}
            />
          </>
        )}

        {tab === 'all' && (
          <>
            <div className="pageHeader">
              <h1>{t('sidebar.allFiles') || 'Tất cả tệp tin'}</h1>
              <p>{t('allFiles.subtitle') || 'Xem và quản lý toàn bộ tệp tin, hình ảnh, tài liệu của bạn tại một nơi.'}</p>
            </div>
            <div className="viewTabs">
              <button 
                className={`tabBtn ${allFilesCollectionView === 'all' ? 'active' : ''}`}
                onClick={() => setAllFilesCollectionView('all')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {t('sidebar.all') || 'Tất cả'}
              </button>
              <button 
                className={`tabBtn ${allFilesCollectionView === 'recent' ? 'active' : ''}`}
                onClick={() => setAllFilesCollectionView('recent')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {t('sidebar.recentlyAdded') || 'Mới thêm'}
              </button>
              <button 
                className={`tabBtn ${allFilesCollectionView === 'trash' ? 'active' : ''}`}
                onClick={() => setAllFilesCollectionView('trash')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                {t('sidebar.trashBin') || 'Thùng rác'}
              </button>
            </div>
            <AssetGrid
              groupByTimeEnabled={groupByTimeEnabled}
              setGroupByTimeEnabled={setGroupByTimeEnabled}
              groupMode={groupMode}
              setGroupMode={setGroupMode}
              collectionView={allFilesCollectionView}
              photoGroups={allActiveAssetsGrouped}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              selectedIds={selectedIds}
              api={api}
              cardHandlers={(item) => cardHandlers(item, () => openAll(item.id))}
              openPhoto={openAll}
              t={t}
            />
          </>
        )}

        {tab === 'spaces' && (
          <div className="spacesDirectory">
            <div className="pageHeader">
              <h1>{t('spaces.title') || 'Không gian con cá nhân'}</h1>
              <p>{t('spaces.subtitle') || 'Quản lý các nhật ký, bộ sưu tập tệp tin và dự án tài liệu riêng tư của bạn.'}</p>
            </div>
            
            <div className="spacesGrid">
              <div className="spaceCard createCard" onClick={() => setShowCreateSpaceModal(true)}>
                <div className="createIcon">＋</div>
                <div className="createLabel">{t('spaces.create') || 'Tạo không gian con'}</div>
                <div className="createSub">Nhật ký, Bộ sưu tập hoặc Dự án</div>
              </div>

              {spaces.map((sp) => (
                <div 
                  key={sp.id} 
                  className="spaceCard"
                  onClick={() => {
                    setActiveWorkspace({ type: 'space', id: sp.id, name: sp.name, spaceType: sp.type });
                    setTab('space');
                    setSelectionMode(false);
                    setSelectedIds([]);
                  }}
                >
                  <div className="spaceCardHeader">
                    <span className="spaceTypeIcon">
                      {sp.type === 'journal' ? '📓' : sp.type === 'collection' ? '📦' : '📂'}
                    </span>
                    <span className="spaceBadge">
                      {sp.type === 'journal' ? (t('spaces.journal') || 'Nhật ký') : sp.type === 'collection' ? (t('spaces.collection') || 'Bộ sưu tập') : (t('spaces.project') || 'Dự án')}
                    </span>
                  </div>
                  <h3 className="spaceCardName">{sp.name}</h3>
                  <p className="spaceCardDesc">{sp.description || 'Không có mô tả cho không gian này.'}</p>
                  <div className="spaceCardFooter">
                    <span>Đã tạo: {new Date(sp.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'space' && activeWorkspace.type === 'space' && activeWorkspace.spaceType === 'project' && (
          <>
            <div className="pageHeader">
              <h1>{activeWorkspace.name}</h1>
              <p>📁 {t('spaces.project') || 'Không gian Dự án'} · {t('spaces.projectDesc') || 'Quản lý tài liệu dự án'}</p>
            </div>
            <DocView
              docTypeFilter={docTypeFilter}
              setDocTypeFilter={setDocTypeFilter}
              docTypes={docTypes}
              selectedDocProject={selectedDocProject}
              docCollectionView={docCollectionView}
              setDocCollectionView={setDocCollectionView}
              docCategoryFilter={docCategoryFilter}
              setDocCategoryFilter={setDocCategoryFilter}
              docsGrouped={spaceAssetsGrouped}
              selectedIds={selectedIds}
              cardHandlers={(item) => cardHandlers(item, () => openSpaceAsset(item.id))}
              openDoc={openSpaceAsset}
              t={t}
            />
          </>
        )}

        {tab === 'space' && activeWorkspace.type === 'space' && activeWorkspace.spaceType !== 'project' && (
          <div className="spaceTimelineView">
            <div className="pageHeader">
              <h1>{activeWorkspace.name}</h1>
              <p>
                {activeWorkspace.spaceType === 'journal' 
                  ? `📓 ${t('spaces.journal') || 'Không gian Nhật ký'} · ${t('spaces.journalDesc') || 'Ghi chép câu chuyện'}`
                  : `📦 ${t('spaces.collection') || 'Không gian Bộ sưu tập'} · ${t('spaces.collectionDesc') || 'Lưu trữ file'}`}
              </p>
            </div>
            <div className="postComposer">
              <textarea 
                className="composerInput"
                placeholder={activeWorkspace.spaceType === 'journal' ? 'Viết gì đó cho hôm nay...' : 'Ghi chú cho tệp đính kèm...'}
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
              />
              <div className="composerActions">
                <label htmlFor="space-file-upload" className="attachBtn">
                  📎 Đính kèm tệp tin ({postFiles.length})
                </label>
                <input 
                  type="file" 
                  id="space-file-upload" 
                  multiple 
                  onChange={(e) => setPostFiles(Array.from(e.target.files || []))} 
                  style={{ display: 'none' }}
                />
                <button className="submitPostBtn" onClick={handleCreatePost} disabled={!postCaption.trim() && postFiles.length === 0}>
                  Đăng bài
                </button>
              </div>
              {postFiles.length > 0 && (
                <div className="attachedFiles">
                  {postFiles.map((f, i) => (
                    <div key={i} className="attachedFileChip">
                      <span>📄 {f.name} ({fmtBytes(f.size)})</span>
                      <button className="removeFileBtn" onClick={() => setPostFiles(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="postsList">
              {posts.length === 0 && (
                <div className="emptyHint">Chưa có bài đăng nào trong không gian này. Hãy là người đầu tiên đăng bài!</div>
              )}
              {posts.map((post) => (
                <div key={post.id} className="postCard">
                  <div className="postHeader">
                    <div className="postAuthor">
                      <span className="avatarCircle">{user ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                      <span className="authorName">{user ? user.name : 'Unknown'}</span>
                    </div>
                    <span className="postTime">{new Date(post.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                  {post.caption && <div className="postCaption">{post.caption}</div>}
                  {post.assets && post.assets.length > 0 && (
                    <div className="postAssets">
                      {post.assets.map((asset: any) => {
                        const isImg = asset.type === 'image';
                        const isVid = asset.type === 'video';
                        const src = `${api}/api/assets/_media/original/${asset.id}`;
                        return (
                          <div key={asset.id} className="postAssetCard" onClick={() => openSpaceAsset(asset.id)}>
                            {isImg && <img src={src} alt={asset.originalName} />}
                            {isVid && (
                              <div className="postVideoThumb">
                                <SmartVideo 
                                  hlsSrc={asset.hlsRelPath ? `${api}/api/assets/_media/hls/${asset.id}/master.m3u8` : undefined} 
                                  mp4Src={asset.playRelPath ? `${api}/api/assets/_media/play/${asset.id}` : `${api}/api/assets/_media/original/${asset.id}`} 
                                  controls 
                                />
                              </div>
                            )}
                            {!isImg && !isVid && (
                              <div className="postFileThumb">
                                <span className="fileIcon">{docIconOf(asset)}</span>
                                <span className="fileName">{asset.originalName}</span>
                                <span className="fileSize">{fmtBytes(asset.size)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <MediaViewer
        active={active}
        tab={tab}
        albumFilteredPhotos={tab === 'all' ? allActiveAssets : tab === 'space' ? spaceAssets : albumFilteredPhotos}
        docsFiltered={tab === 'all' ? allActiveAssets : tab === 'space' ? spaceAssets : docsFiltered}
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
        groupByTimeEnabled={groupByTimeEnabled}
        setGroupByTimeEnabled={setGroupByTimeEnabled}
        groupMode={groupMode}
        setGroupMode={setGroupMode}
      />
      <CreateSpaceModal
        isOpen={showCreateSpaceModal}
        onClose={() => setShowCreateSpaceModal(false)}
        onCreate={handleCreateSpace}
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

        .spaceTimelineView {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .postComposer {
          background: var(--bg-tile);
          border: 1px solid var(--border-tile);
          border-radius: 16px;
          padding: 16px;
          box-shadow: var(--card-shadow);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .viewTabs {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
        }
        .tabBtn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 600;
          padding: 8px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
          border-radius: 6px 6px 0 0;
        }
        .tabBtn:hover {
          color: var(--text-primary);
          background: var(--bg-item-hover);
        }
        .tabBtn.active {
          color: var(--text-primary);
          border-bottom: 2px solid var(--button-primary-bg);
        }
        .composerInput {
          width: 100%;
          min-height: 80px;
          background: var(--bg-input);
          border: 1px solid var(--border-input);
          color: var(--text-primary);
          border-radius: 12px;
          padding: 12px;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          resize: vertical;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }
        .composerInput:focus {
          border-color: var(--border-input-focus);
          background: var(--bg-input-focus);
        }
        .composerActions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .attachBtn {
          background: var(--bg-input);
          border: 1px solid var(--border-input);
          color: var(--text-secondary);
          padding: 8px 16px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        .attachBtn:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }
        .submitPostBtn {
          background: var(--button-primary-bg);
          color: var(--button-primary-text);
          border: 0;
          padding: 8px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 10px var(--button-primary-shadow);
        }
        .submitPostBtn:hover:not(:disabled) {
          background: var(--button-primary-hover);
          transform: translateY(-1px);
        }
        .submitPostBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
        .attachedFiles {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 1px solid var(--border-color);
          padding-top: 12px;
        }
        .attachedFileChip {
          background: var(--bg-item-active);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 6px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-primary);
        }
        .removeFileBtn {
          background: transparent;
          border: 0;
          color: var(--text-muted);
          font-size: 16px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .removeFileBtn:hover {
          color: #f87171;
        }
        .postsList {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .emptyHint {
          text-align: center;
          color: var(--text-muted);
          font-style: italic;
          font-size: 14px;
          padding: 40px 0;
        }
        .postCard {
          background: var(--bg-tile);
          border: 1px solid var(--border-tile);
          border-radius: 16px;
          padding: 20px;
          box-shadow: var(--card-shadow);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .postHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 10px;
        }
        .postAuthor {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .avatarCircle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--button-primary-bg);
          color: var(--button-primary-text);
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 14px;
        }
        .authorName {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
        }
        .postTime {
          font-size: 12px;
          color: var(--text-muted);
        }
        .postCaption {
          font-size: 14.5px;
          color: var(--text-primary);
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .postAssets {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .postAssetCard {
          border: 1px solid var(--border-tile);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg-input);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .postAssetCard:hover {
          transform: scale(1.02);
          border-color: var(--border-tile-hover);
        }
        .postAssetCard img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .postVideoThumb {
          width: 100%;
          height: 100%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .postFileThumb {
          padding: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
          width: 100%;
          box-sizing: border-box;
        }
        .fileIcon {
          font-size: 32px;
        }
        .fileName {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }
        .fileSize {
          font-size: 10px;
          color: var(--text-muted);
        }

        .spacesDirectory {
          animation: contentSwitch .35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pageHeader {
          margin-bottom: 24px;
        }
        .pageHeader h1 {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
          color: var(--text-primary);
          margin-top: 0;
        }
        .pageHeader p {
          font-size: 14px;
          color: var(--text-muted);
          margin-top: 0;
          margin-bottom: 0;
        }
        .spacesGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .spaceCard {
          background: var(--bg-tile);
          border: 1px solid var(--border-tile);
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          box-shadow: var(--card-shadow);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
        }
        .spaceCard:hover {
          transform: translateY(-4px);
          border-color: var(--border-tile-hover);
          box-shadow: var(--card-shadow-hover);
        }
        .spaceCardHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .spaceTypeIcon {
          font-size: 24px;
        }
        .spaceBadge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 99px;
          background: var(--bg-item-active);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }
        .spaceCardName {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .spaceCardDesc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
          flex-grow: 1;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .spaceCardFooter {
          font-size: 11px;
          color: var(--text-muted);
          border-top: 1px solid var(--border-color);
          padding-top: 8px;
        }
        .createCard {
          border: 2px dashed var(--border-color);
          background: transparent;
          justify-content: center;
          align-items: center;
          text-align: center;
          box-shadow: none;
        }
        .createCard:hover {
          border-color: var(--border-input-focus);
          background: rgba(255, 255, 255, 0.01);
        }
        .createIcon {
          font-size: 32px;
          color: var(--text-muted);
          margin-bottom: 8px;
        }
        .createLabel {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .createSub {
          font-size: 12px;
          color: var(--text-muted);
        }

        @media (max-width: 900px) {
          .shell { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
