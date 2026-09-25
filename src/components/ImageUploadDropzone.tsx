import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, Link as LinkIcon, Check, Eye } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

interface ImageUploadDropzoneProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  sublabel?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  onView?: () => void;
}

export const ImageUploadDropzone: React.FC<ImageUploadDropzoneProps> = ({
  value,
  onChange,
  label,
  sublabel = 'Drag & drop, click to upload, or paste screenshot (Ctrl+V)',
  placeholder = 'Or paste image/TradingView URL...',
  className = '',
  compact = false,
  onView,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP, GIF).');
      return;
    }
    setIsProcessing(true);
    try {
      const compressedDataUrl = await compressImage(file, 1600, 1200, 0.82);
      onChange(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress image', err);
      // Fallback: direct file reader
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await processFile(file);
          return;
        }
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
    e.target.value = '';
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  if (value) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {label && <label className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 block">{label}</label>}
        <div className="relative group rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900">
          <img
            src={value}
            alt="Chart screenshot preview"
            className="w-full h-36 object-cover object-center cursor-pointer transition hover:opacity-95"
            onClick={onView}
          />
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {onView && (
              <button
                type="button"
                onClick={onView}
                className="px-2.5 py-1.5 rounded bg-slate-900/90 text-slate-100 hover:bg-slate-800 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>View Full</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded bg-slate-900/90 text-slate-100 hover:bg-slate-800 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Replace</span>
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-1.5 rounded bg-rose-900/90 text-rose-200 hover:bg-rose-800 text-xs shadow-md"
              title="Remove screenshot"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`} onPaste={handlePaste}>
      {label && <label className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 block">{label}</label>}

      {compact ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-xs font-mono transition cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
            <span>{isProcessing ? 'Optimizing image...' : 'Upload Chart Screenshot'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="p-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs"
            title="Paste Image Link / TradingView URL"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          tabIndex={0}
          className={`relative rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 outline-none focus:border-sky-500 ${
            isDragging
              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-900/80'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <UploadCloud className="w-4 h-4" />
          </div>

          <div className="space-y-0.5">
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {isProcessing ? 'Optimizing screenshot...' : 'Upload Chart Screenshot'}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs">{sublabel}</p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowUrlInput(!showUrlInput);
            }}
            className="text-[10px] font-mono text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mt-1"
          >
            <LinkIcon className="w-2.5 h-2.5" />
            <span>Or use web link / TradingView URL</span>
          </button>
        </div>
      )}

      {showUrlInput && (
        <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 pt-1 animate-in fade-in">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-mono outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold"
          >
            Attach
          </button>
        </form>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
