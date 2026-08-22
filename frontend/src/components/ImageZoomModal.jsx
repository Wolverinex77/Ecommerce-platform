import React, { useState, useEffect, useRef, useCallback } from "react";
import { getImageUrl } from "../services/api";

export default function ImageZoomModal({
  isOpen,
  onClose,
  images = [],
  initialIndex = 0,
  productName = "Product Image",
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef(null);

  // Sync index when opening or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoomLevel(1);
      setPosition({ x: 0, y: 0 });
      setImageError(false);
    }
  }, [isOpen, initialIndex]);

  // Reset zoom & pan when image index changes
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    resetZoom();
    setImageError(false);
  }, [images.length, resetZoom]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    resetZoom();
    setImageError(false);
  }, [images.length, resetZoom]);

  // Keyboard navigation & escape handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "+" || e.key === "=") {
        setZoomLevel((z) => Math.min(z + 0.5, 4));
      } else if (e.key === "-") {
        setZoomLevel((z) => {
          const next = Math.max(z - 0.5, 1);
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Lock background scrolling
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose, handleNext, handlePrev]);

  // Zoom controls
  const handleZoomIn = (e) => {
    e?.stopPropagation();
    setZoomLevel((z) => Math.min(z + 0.5, 4));
  };

  const handleZoomOut = (e) => {
    e?.stopPropagation();
    setZoomLevel((z) => {
      const next = Math.max(z - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleToggleZoom = (e) => {
    e?.stopPropagation();
    if (zoomLevel > 1) {
      resetZoom();
    } else {
      setZoomLevel(2.5);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setZoomLevel((prevZoom) => {
      const newZoom = Math.min(Math.max(prevZoom + delta, 1), 4);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      return newZoom;
    });
  };

  // Panning with Mouse
  const handleMouseDown = (e) => {
    if (zoomLevel <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoomLevel <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e) => {
    if (zoomLevel <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y,
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || zoomLevel <= 1 || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!isOpen || images.length === 0) return null;

  const currentRaw = images[currentIndex] || images[0];
  const currentUrl = getImageUrl(currentRaw);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Product Image Viewer"
      onClick={onClose}
    >
      {/* Top Floating Control Bar */}
      <header
        className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image index & product title */}
        <div className="flex items-center gap-3 bg-surface/80 border border-hairline px-4 py-2 rounded-md backdrop-blur-md shadow-lg">
          <span className="font-display font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
            {productName}
          </span>
          {images.length > 1 && (
            <span className="text-xs text-forest font-semibold border-l border-hairline pl-3">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* Zoom and Close Controls */}
        <div className="flex items-center gap-2 bg-surface/80 border border-hairline p-1.5 rounded-md backdrop-blur-md shadow-lg">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 1}
            className="w-8 h-8 rounded-sm flex items-center justify-center text-white hover:bg-paper hover:text-forest disabled:opacity-40 transition-colors"
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
            </svg>
          </button>

          {/* Current Zoom Level % */}
          <button
            type="button"
            onClick={resetZoom}
            className="px-2.5 h-8 rounded-sm text-xs font-bold text-white hover:bg-paper hover:text-forest transition-colors"
            title="Reset Zoom"
          >
            {Math.round(zoomLevel * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 4}
            className="w-8 h-8 rounded-sm flex items-center justify-center text-white hover:bg-paper hover:text-forest disabled:opacity-40 transition-colors"
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          <span className="w-px h-5 bg-hairline mx-1" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-sm flex items-center justify-center text-ink-soft hover:text-rust hover:bg-paper transition-colors"
            title="Close (Escape)"
            aria-label="Close image viewer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Image Viewport Area */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden p-6 sm:p-12 cursor-default"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {currentUrl && !imageError ? (
          <img
            src={currentUrl}
            alt={productName}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            onDoubleClick={handleToggleZoom}
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
              transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)",
              cursor: zoomLevel > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
            }}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-sm shadow-2xl transition-all select-none pointer-events-auto"
          />
        ) : (
          <div className="text-center text-ink-soft space-y-2">
            <svg className="w-16 h-16 mx-auto text-ink-soft/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">Image could not be loaded</p>
          </div>
        )}
      </div>

      {/* Navigation Arrows for Multi-image Products */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-surface/80 hover:bg-forest hover:text-black border border-hairline text-white flex items-center justify-center shadow-2xl backdrop-blur-md transition-all z-50 pointer-events-auto group"
            title="Previous image (Left Arrow)"
            aria-label="Previous image"
          >
            <svg className="w-6 h-6 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-surface/80 hover:bg-forest hover:text-black border border-hairline text-white flex items-center justify-center shadow-2xl backdrop-blur-md transition-all z-50 pointer-events-auto group"
            title="Next image (Right Arrow)"
            aria-label="Next image"
          >
            <svg className="w-6 h-6 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Floating Bottom Instructions */}
      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-surface/70 border border-hairline text-[11px] text-ink-soft backdrop-blur-md pointer-events-none hidden sm:flex items-center gap-3">
        <span>Double-click or Scroll to Zoom</span>
        <span>•</span>
        <span>Drag to Pan</span>
        <span>•</span>
        <span>Esc to Close</span>
      </footer>
    </div>
  );
}
