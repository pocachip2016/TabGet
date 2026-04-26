import { useState, useEffect, useRef } from 'react';

export default function ProductSlideshow({
  images = [],
  videoUrl = '',
  paused = false,
  intervalMs = 3500,
  kenBurns = true,
  animDuration = 3500,
  animDelay = 0,
}) {
  const [validImages, setValidImages] = useState([]);
  const [current, setCurrent] = useState(0);
  const isVisibleRef = useRef(true);
  const intervalRef = useRef(null);

  // Preload + validate images
  useEffect(() => {
    const deduped = [...new Set(images.filter(Boolean))];
    if (deduped.length === 0) {
      setValidImages([]);
      return;
    }

    let cancelled = false;
    const valid = new Array(deduped.length).fill(null);
    let pending = deduped.length;

    const finish = () => {
      if (cancelled) return;
      setValidImages(valid.filter(Boolean));
    };

    deduped.forEach((url, i) => {
      const img = new window.Image();
      img.onload = () => { valid[i] = url; if (--pending === 0) finish(); };
      img.onerror = () => { if (--pending === 0) finish(); };
      img.src = url;
    });

    return () => { cancelled = true; };
  }, [images.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setCurrent(0); }, [validImages]);

  // Visibility API guard
  useEffect(() => {
    const handler = () => { isVisibleRef.current = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Slideshow interval
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (paused || validImages.length <= 1) return;
    intervalRef.current = setInterval(() => {
      if (!isVisibleRef.current) return;
      setCurrent(c => (c + 1) % validImages.length);
    }, intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [paused, validImages.length, intervalMs]);

  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        autoPlay muted loop playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
    );
  }

  if (validImages.length === 0) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
        <span className="text-white/30 text-[10px]">No Image</span>
      </div>
    );
  }

  return (
    <>
      {validImages.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          fetchPriority={i === 0 ? 'high' : 'auto'}
          loading={i === 0 ? 'eager' : 'lazy'}
          style={{
            animationDuration: `${animDuration}ms`,
            animationDelay: `${animDelay}ms`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
          className={[
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-700',
            i === current ? 'opacity-100' : 'opacity-0',
            kenBurns ? (i % 2 === 0 ? 'ken-burns-a' : 'ken-burns-b') : '',
          ].join(' ')}
        />
      ))}
    </>
  );
}
