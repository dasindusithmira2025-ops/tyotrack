import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '../ui/Button';

interface ShiftUploadDropzoneProps {
  onFileSelected: (file: File) => Promise<void> | void;
  isUploading?: boolean;
}

export const ShiftUploadDropzone: React.FC<ShiftUploadDropzoneProps> = ({ onFileSelected, isUploading }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    await onFileSelected(file);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setIsDragging(false);
        await handleFiles(event.dataTransfer.files);
      }}
      className={`rounded-2xl border border-dashed p-6 text-center transition-all ${
        isDragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700 bg-slate-950/40'
      }`}
    >
      <UploadCloud className="w-8 h-8 mx-auto text-cyan-300 mb-3" />
      <h3 className="text-white font-semibold">Bulk Upload Schedule</h3>
      <p className="text-sm text-slate-400 mt-2">Drag and drop a `.csv` or `.xlsx` file here, or browse manually.</p>
      <div className="mt-4 flex justify-center">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} isLoading={isUploading}>
          Choose File
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </div>
  );
};
