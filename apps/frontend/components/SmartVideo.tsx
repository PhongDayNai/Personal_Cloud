'use client';

import React, { useRef, useState, useEffect } from 'react';

interface SmartVideoProps {
  hlsSrc: string;
  mp4Src: string;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  preload?: string;
  active?: boolean;
  onMeta?: (meta: { w: number; h: number }) => void;
}

export default function SmartVideo({ 
  hlsSrc, 
  mp4Src, 
  className, 
  controls = false, 
  autoPlay = false, 
  muted = false, 
  preload = 'metadata', 
  active = true, 
  onMeta 
}: SmartVideoProps): React.JSX.Element {
  const ref = useRef<HTMLVideoElement>(null);
  const [fallbackToMp4, setFallbackToMp4] = useState<boolean>(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let hls: any;
    let cancelled = false;

    async function setup() {
      console.log('[SmartVideo] Khởi tạo trình phát. hlsSrc:', hlsSrc, 'mp4Src:', mp4Src, 'fallbackToMp4:', fallbackToMp4);
      if (fallbackToMp4 || !hlsSrc) {
        console.log('[SmartVideo] Sử dụng nguồn MP4 trực tiếp:', mp4Src);
        el.src = mp4Src;
        return;
      }

      if (el.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('[SmartVideo] Trình duyệt hỗ trợ HLS mặc định (Safari).');
        el.src = hlsSrc;
        return;
      }

      try {
        console.log('[SmartVideo] Đang tải hls.js...');
        const mod = await import('hls.js');
        const Hls = mod.default;
        if (!Hls.isSupported()) {
          console.warn('[SmartVideo] Trình duyệt không hỗ trợ hls.js. Fallback sang MP4.');
          el.src = mp4Src;
          return;
        }

        if (cancelled) return;
        console.log('[SmartVideo] hls.js được hỗ trợ. Khởi tạo instance Hls...');
        hls = new Hls({
          maxBufferLength: 120,
          maxMaxBufferLength: 300,
          backBufferLength: 90,
          enableWorker: true,
          startLevel: -1,
          xhrSetup: (xhr: XMLHttpRequest) => {
            xhr.withCredentials = true;
          }
        });

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          console.log('[SmartVideo] Hls: Đã kết nối media element.');
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event: any, data: any) => {
          console.log('[SmartVideo] Hls: Manifest đã được parse thành công. Các stream khả dụng:', data.levels);
        });

        hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
          console.error('[SmartVideo] Hls Lỗi:', data);
          if (data?.fatal) {
            console.warn('[SmartVideo] Hls gặp lỗi nghiêm trọng (fatal). Chuyển hướng sang MP4...');
            try { hls.destroy(); } catch { }
            setFallbackToMp4(true);
          }
        });

        hls.loadSource(hlsSrc);
        hls.attachMedia(el);
      } catch (err) {
        console.error('[SmartVideo] Lỗi nạp hls.js:', err);
        el.src = mp4Src;
      }
    }

    setup();

    return () => {
      cancelled = true;
      try { if (hls) hls.destroy(); } catch { }
    };
  }, [hlsSrc, mp4Src, fallbackToMp4]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active && autoPlay) {
      console.log('[SmartVideo] Kích hoạt autoPlay...');
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.warn('[SmartVideo] Trình duyệt chặn tự động phát (autoPlay blocked):', err.message);
        });
      }
    } else {
      el.pause();
    }
  }, [active, autoPlay]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof onMeta !== 'function') return;
    const onLoadedMeta = () => {
      console.log('[SmartVideo] Sự kiện loadedmetadata. Kích thước gốc:', el.videoWidth, 'x', el.videoHeight, 'Thời lượng:', el.duration);
      onMeta({ w: el.videoWidth || 0, h: el.videoHeight || 0 });
    };
    el.addEventListener('loadedmetadata', onLoadedMeta);
    return () => el.removeEventListener('loadedmetadata', onLoadedMeta);
  }, [onMeta]);

  return (
    <video
      ref={ref}
      className={className}
      controls={controls}
      muted={muted}
      preload={preload}
      playsInline
      crossOrigin="use-credentials"
      style={{ width: 'auto', height: 'calc(100% - 36px)', maxWidth: '100%', maxHeight: 'calc(100% - 36px)', objectFit: 'contain' }}
      onPlay={() => console.log('[SmartVideo] Native Event: play')}
      onPause={() => console.log('[SmartVideo] Native Event: pause')}
      onWaiting={() => console.log('[SmartVideo] Native Event: waiting')}
      onPlaying={() => console.log('[SmartVideo] Native Event: playing')}
      onCanPlay={() => console.log('[SmartVideo] Native Event: canplay')}
      onError={(e: any) => {
        const err = e.target.error;
        console.error('[SmartVideo] Native Event Lỗi:', err ? { code: err.code, message: err.message } : e);
        if (!fallbackToMp4) {
          console.warn('[SmartVideo] Trình phát gặp lỗi hệ thống. Đang tự động chuyển sang luồng MP4 tương thích...');
          setFallbackToMp4(true);
        }
      }}
    />
  );
}
