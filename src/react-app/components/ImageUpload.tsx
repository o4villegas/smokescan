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
};

export function ImageUpload({
  images,
  previewUrls,
  onImagesChange,
  onNext,
  maxImages = 10,
  isLoadingMetadata = false,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Upload Damage Photos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload photos of the fire/smoke-damaged area for assessment.
          Maximum {maxImages} images.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop Zone */}
        <div
          className={cn(
            'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
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
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Drag & drop images here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">
                {images.length} of {maxImages} images selected
              </p>
            </div>
          </div>
        </div>

        {/* Image Previews */}
        {previewUrls.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {previewUrls.map((url, index) => (
              <div key={url} className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-white truncate block">
                    {images[index]?.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {previewUrls.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No images selected yet</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <Button onClick={onNext} disabled={images.length === 0 || isLoadingMetadata}>
            {isLoadingMetadata ? 'Loading...' : 'Continue to Details'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
