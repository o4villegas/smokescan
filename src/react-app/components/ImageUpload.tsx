/**
 * ImageUpload Component
 * Drag-and-drop or click-to-upload interface for damage photos
 */

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ImageUploadProps = {
  images: File[];
  previewUrls: string[];
  onImagesChange: (images: File[], previewUrls: string[]) => void;
  onNext: () => void;
  maxImages?: number;
  isLoadingMetadata?: boolean; // When true, disables Next button (waiting for metadata pre-fill)
  embedded?: boolean; // When true, renders without Card wrapper (for combined layout)
};

export function ImageUpload({
  images,
  previewUrls,
  onImagesChange,
  onNext,
  maxImages = 10,
  isLoadingMetadata = false,
  embedded = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const validFiles: File[] = [];
      const validUrls: string[] = [];

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        if (images.length + validFiles.length >= maxImages) return;

        validFiles.push(file);
        validUrls.push(URL.createObjectURL(file));
      });

      onImagesChange(
        [...images, ...validFiles],
        [...previewUrls, ...validUrls]
      );
    },
    [images, previewUrls, onImagesChange, maxImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      const newUrls = previewUrls.filter((_, i) => i !== index);
      // Revoke the old URL to free memory
      URL.revokeObjectURL(previewUrls[index]);
      onImagesChange(newImages, newUrls);
    },
    [images, previewUrls, onImagesChange]
  );

  // Core content that's shared between embedded and standalone modes
  const uploadContent = (
    <div className={cn('space-y-4', !embedded && 'space-y-6')}>
      {/* Section Header (embedded mode only) */}
      {embedded && (
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-base font-medium">Damage Photos *</span>
        </div>
      )}

      {/* Drop Zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer',
          embedded ? 'p-4' : 'p-8',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id="file-input"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-2">
          <div className={cn('rounded-full bg-muted', embedded ? 'p-2' : 'p-4')}>
            <Upload className={cn('text-muted-foreground', embedded ? 'h-5 w-5' : 'h-8 w-8')} />
          </div>
          <div>
            <p className={cn('font-medium', embedded && 'text-sm')}>
              {embedded ? 'Drop images or click to browse' : 'Drag & drop images here or click to browse'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {images.length} of {maxImages} images selected
            </p>
          </div>
        </div>
      </div>

      {/* Image Previews */}
      {previewUrls.length > 0 && (
        <div className={cn(
          'grid gap-2',
          embedded ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'
        )}>
          {previewUrls.map((url, index) => (
            <div key={url} className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                className={cn(
                  'absolute top-1 right-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80',
                  embedded ? 'p-1' : 'p-1.5 top-2 right-2'
                )}
                aria-label="Remove image"
              >
                <X className={cn(embedded ? 'h-3 w-3' : 'h-4 w-4')} />
              </button>
              {!embedded && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-white truncate block">
                    {images[index]?.name}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {previewUrls.length === 0 && (
        <div className={cn(
          'flex flex-col items-center justify-center text-center border rounded-lg bg-muted/20',
          embedded ? 'py-4' : 'py-8'
        )}>
          <ImageIcon className={cn('text-muted-foreground/50 mb-2', embedded ? 'h-8 w-8' : 'h-12 w-12 mb-3')} />
          <p className="text-sm text-muted-foreground">No images selected yet</p>
        </div>
      )}

      {/* Actions (standalone mode only) */}
      {!embedded && (
        <div className="flex justify-end">
          <Button onClick={onNext} disabled={images.length === 0 || isLoadingMetadata}>
            {isLoadingMetadata ? 'Loading...' : 'Continue to Details'}
          </Button>
        </div>
      )}
    </div>
  );

  // Standalone mode: wrap in Card
  if (!embedded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Upload Damage Photos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload photos of the fire/smoke-damaged area for assessment.
            Maximum {maxImages} images.
          </p>
        </CardHeader>
        <CardContent>
          {uploadContent}
        </CardContent>
      </Card>
    );
  }

  // Embedded mode: return content directly
  return uploadContent;
}
