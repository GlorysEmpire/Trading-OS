import React, { useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxImage {
  url: string;
  title: string;
  subtitle?: string;
  badge?: string;
  timeframe?: string;
  notes?: string;
}

interface ImageViewerModalProps {
  images: LightboxImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [zoom, setZoom] = React.useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0 && onNavigate) {
        onNavigate(currentIndex - 1);
        setZoom(1);
      }
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1 && onNavigate) {
        onNavigate(currentIndex + 1);
        setZoom(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  if (!isOpen || images.length === 0) return null;

  const currentImg = images[currentIndex] || images[0];

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImg.url;
    link.download = `${currentImg.title.replace(/\s+/g, '_') || 'chart'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-md text-slate-100 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/90 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-slate-100">
            {currentImg.badge && (
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs">
                {currentImg.badge}
              </span>
            )}
            <span>{currentImg.title}</span>
          </div>
          {currentImg.timeframe && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              TF: {currentImg.timeframe}
            </span>
          )}
          {images.length > 1 && (
            <span className="text-xs font-mono text-slate-400">
              ({currentIndex + 1} of {images.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 mr-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              title="Zoom out"
              className="p-1 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[11px]">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              title="Zoom in"
              className="p-1 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom !== 1 && (
              <button
                onClick={() => setZoom(1)}
                title="Reset zoom"
                className="text-[10px] text-sky-400 hover:text-sky-300 ml-1"
              >
                Reset
              </button>
            )}
          </div>

          <button
            onClick={handleDownload}
            title="Download Chart"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 rounded hover:bg-rose-900/40 text-slate-400 hover:text-rose-200 transition ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-auto">
        {/* Navigation Arrows */}
        {images.length > 1 && currentIndex > 0 && onNavigate && (
          <button
            onClick={() => {
              onNavigate(currentIndex - 1);
              setZoom(1);
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-xl transition"
            title="Previous screenshot (Left arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {images.length > 1 && currentIndex < images.length - 1 && onNavigate && (
          <button
            onClick={() => {
              onNavigate(currentIndex + 1);
              setZoom(1);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-xl transition"
            title="Next screenshot (Right arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        <div
          className="transition-transform duration-100 max-h-[85vh] flex items-center justify-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <img
            src={currentImg.url}
            alt={currentImg.title}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-md shadow-2xl border border-slate-800 select-none"
          />
        </div>
      </div>

      {/* Bottom Notes / Details Bar */}
      {(currentImg.subtitle || currentImg.notes) && (
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 text-xs font-sans text-slate-300 max-h-24 overflow-y-auto">
          {currentImg.subtitle && (
            <div className="font-semibold text-slate-200 mb-0.5">{currentImg.subtitle}</div>
          )}
          {currentImg.notes && <p className="text-slate-400">{currentImg.notes}</p>}
        </div>
      )}
    </div>
  );
};
