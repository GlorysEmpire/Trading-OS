import React, { useState, useRef } from 'react';
import { ChartImage } from './ChartImage';
import { UploadCloud, Image as ImageIcon, X, Link as LinkIcon, Check, Eye, Images } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { uploadChart } from '../lib/chartStorage';

/** Compress an image file and upload it to chart storage. Falls back to an
 * inline data URL (with a note) if storage isn't available, so a screenshot
 * is never lost. */
export async function processImageFile(file: File): Promise<{ url: string; note?: string }> {
  let dataUrl: string;
  try {
    dataUrl = await compressImage(file, 1600, 1200, 0.82);
  } catch (err) {
    console.error('Failed to compress image', err);
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  try {
    return { url: await uploadChart(dataUrl) };
  } catch (err) {
    return { url: dataUrl, note: `Saved inline, not in file storage: ${err instanceof Error ? err.message : 'upload failed'}` };
  }
}

const imageFiles = (list: FileList | File[] | null | undefined) => Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));

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
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, WEBP, GIF).');
      return;
    }
    setIsProcessing(true);
    setUploadNote(null);
    try {
      const { url, note } = await processImageFile(file);
      onChange(url);
      if (note) setUploadNote(note);
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
          <ChartImage
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
        {uploadNote && <p className="text-[10px] font-mono text-amber-400">{uploadNote}</p>}
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


interface MultiImageDropzoneProps {
  /** Called once per batch with every uploaded image, in the order given. */
  onAdd: (urls: string[]) => void;
  label?: string;
  sublabel?: string;
  className?: string;
  compact?: boolean;
}

/** Drop area for several screenshots at once: pick multiple files, drag a
 * batch in, or paste. Each image is compressed and uploaded to chart storage. */
export const MultiImageDropzone: React.FC<MultiImageDropzoneProps> = ({
  onAdd,
  label,
  sublabel = 'Select or drag several screenshots at once, or paste (Ctrl+V)',
  className = '',
  compact = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setNote(null);
    setProgress({ done: 0, total: files.length });
    const urls: string[] = [];
    let lastNote: string | undefined;
    for (const file of files) {
      const r = await processImageFile(file);
      urls.push(r.url);
      if (r.note) lastNote = r.note;
      setProgress({ done: urls.length, total: files.length });
    }
    onAdd(urls);
    setProgress(null);
    if (lastNote) setNote(lastNote);
  };

  return (
    <div
      className={`space-y-1.5 ${className}`}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData?.items ?? [])
          .filter((i) => i.type.startsWith('image/'))
          .map((i) => i.getAsFile())
          .filter((f): f is File => !!f);
        if (files.length) { e.preventDefault(); void handleFiles(files); }
      }}
    >
      {label && <label className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 block">{label}</label>}
      <div
        tabIndex={0}
        onClick={() => !progress && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); void handleFiles(imageFiles(e.dataTransfer.files)); }}
        className={`rounded-md border-2 border-dashed cursor-pointer transition flex items-center justify-center gap-2 text-center outline-none focus:border-cyan-600 ${
          compact ? 'px-3 py-2' : 'px-4 py-5'
        } ${isDragging ? 'border-cyan-500 bg-cyan-950/30' : 'border-slate-700 bg-[#0d131d] hover:border-slate-500'}`}
      >
        <Images className="w-4 h-4 text-cyan-400 shrink-0" />
        <div className="text-left">
          <span className="block text-xs font-mono font-bold text-slate-200">
            {progress ? `Uploading ${progress.done}/${progress.total}…` : 'Add screenshots'}
          </span>
          {!compact && !progress && <span className="block text-[10px] font-mono text-slate-500">{sublabel}</span>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = imageFiles(e.target.files);
          e.target.value = '';
          await handleFiles(files);
        }}
      />
      {note && <p className="text-[10px] font-mono text-amber-400">{note}</p>}
    </div>
  );
};

/** Thumbnail strip for a list of screenshots, with view and remove. */
export const ImageThumbGrid: React.FC<{
  images: string[];
  onView?: (index: number) => void;
  onRemove?: (index: number) => void;
  className?: string;
}> = ({ images, onView, onRemove, className = '' }) => {
  if (!images.length) return null;
  return (
    <div className={`grid grid-cols-3 sm:grid-cols-5 gap-2 ${className}`}>
      {images.map((src, i) => (
        <div key={`${src.slice(-24)}-${i}`} className="relative group rounded border border-slate-800 overflow-hidden bg-slate-900">
          <ChartImage src={src} className="w-full h-16 object-cover cursor-pointer" onClick={() => onView?.(i)} />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 p-0.5 rounded bg-slate-950/80 text-rose-300 opacity-0 group-hover:opacity-100 transition"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
