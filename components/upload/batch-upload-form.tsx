'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  UploadCloud, X, Check, Loader2, ChevronRight, ChevronLeft,
  File as FileIcon, AlertCircle, Images,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE, SORTED_CONTENT_TYPES, CONTENT_TYPE_LABELS, AUDIENCE_LABELS, formatFileSize } from '@/lib/utils';
import type { ContentTypeEnum, AudienceTagEnum, TagRow } from '@/types/database';

const AUDIENCE_TYPES = Object.keys(AUDIENCE_LABELS) as AudienceTagEnum[];

function detectContentType(file: File): ContentTypeEnum {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video_file';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.includes('presentation') || file.type.includes('powerpoint')) return 'presentation';
  if (file.type.includes('word')) return 'other';
  return 'other';
}

interface BatchFile {
  id: string;
  file: File;
  contentType: ContentTypeEnum;
  previewUrl: string | null;
  // After upload
  dbId?: string;
  fileUrl?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  errorMsg?: string;
  uploadProgress?: number;
}

interface BatchItemDetails {
  title: string;
  description: string;
  content_type: ContentTypeEnum;
  product_tags: string[];
  topic_tags: string[];
  medium_tags: string[];
  audience_tags: string[];
  status: 'draft' | 'published';
}

interface BatchUploadFormProps {
  productTags: TagRow[];
  topicTags: TagRow[];
  mediumTags: TagRow[];
}

type Phase = 'select' | 'uploading' | 'details';

export function BatchUploadForm({ productTags, topicTags, mediumTags }: BatchUploadFormProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('select');
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detailsMap, setDetailsMap] = useState<Record<string, BatchItemDetails>>({});
  const [savingDetail, setSavingDetail] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: BatchFile[] = acceptedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      contentType: detectContentType(file),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      status: 'pending',
    }));
    setBatchFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled: phase !== 'select',
  });

  function removeFile(id: string) {
    setBatchFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  function updateContentType(id: string, ct: ContentTypeEnum) {
    setBatchFiles((prev) => prev.map((f) => f.id === id ? { ...f, contentType: ct } : f));
  }

  async function uploadAll() {
    if (batchFiles.length === 0) return;
    setPhase('uploading');

    const updated = [...batchFiles];

    for (let i = 0; i < updated.length; i++) {
      const bf = updated[i];
      updated[i] = { ...bf, status: 'uploading', uploadProgress: 0 };
      setBatchFiles([...updated]);

      try {
        // 1. Get presigned URL
        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: bf.file.name,
            content_type_mime: bf.file.type,
            content_type: bf.contentType,
          }),
        });
        const presignJson = await presignRes.json();
        if (!presignRes.ok) throw new Error(presignJson.error || 'Presign failed');

        const { upload_url, public_url } = presignJson;

        // 2. Upload to R2
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              updated[i] = { ...updated[i], uploadProgress: Math.round((e.loaded / e.total) * 100) };
              setBatchFiles([...updated]);
            }
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.open('PUT', upload_url);
          xhr.setRequestHeader('Content-Type', bf.file.type);
          xhr.send(bf.file);
        });

        // 3. Create draft DB record with filename as temporary title
        const completeRes = await fetch('/api/upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: bf.file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            content_type: bf.contentType,
            file_url: public_url,
            file_size_bytes: bf.file.size,
            file_type_mime: bf.file.type,
            status: 'draft',
            product_tags: [],
            topic_tags: [],
            audience_tags: [],
            medium_tags: [],
            meta: {},
          }),
        });
        const completeJson = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeJson.error || 'Failed to save');

        updated[i] = { ...updated[i], status: 'uploaded', dbId: completeJson.id, fileUrl: public_url, uploadProgress: 100 };

        // Fire B2 backup
        fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_id: completeJson.id, file_url: public_url, file_type: bf.file.type }),
        }).catch(() => {});

      } catch (err) {
        updated[i] = { ...updated[i], status: 'error', errorMsg: err instanceof Error ? err.message : 'Failed' };
      }

      setBatchFiles([...updated]);
    }

    // Init details for successfully uploaded files
    const initialDetails: Record<string, BatchItemDetails> = {};
    updated.filter((f) => f.status === 'uploaded').forEach((f) => {
      initialDetails[f.id] = {
        title: f.file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        description: '',
        content_type: f.contentType,
        product_tags: [],
        topic_tags: [],
        medium_tags: [],
        audience_tags: [],
        status: 'draft',
      };
    });
    setDetailsMap(initialDetails);
    setCurrentIndex(0);
    setPhase('details');
  }

  const successFiles = batchFiles.filter((f) => f.status === 'uploaded');
  const currentFile = successFiles[currentIndex];
  const currentDetails = currentFile ? (detailsMap[currentFile.id] || {
    title: '', description: '', content_type: currentFile.contentType,
    product_tags: [], topic_tags: [], medium_tags: [], audience_tags: [], status: 'draft' as const,
  }) : null;

  function updateCurrentDetails(patch: Partial<BatchItemDetails>) {
    if (!currentFile) return;
    setDetailsMap((prev) => ({
      ...prev,
      [currentFile.id]: { ...(prev[currentFile.id] || {}), ...patch } as BatchItemDetails,
    }));
  }

  function toggleTag(field: 'product_tags' | 'topic_tags' | 'medium_tags' | 'audience_tags', value: string) {
    if (!currentDetails) return;
    const current = currentDetails[field] as string[];
    updateCurrentDetails({
      [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  }

  async function saveCurrentAndNext(goNext: boolean) {
    if (!currentFile || !currentDetails) return;
    setSavingDetail(true);
    try {
      const res = await fetch('/api/upload/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentFile.dbId,
          ...currentDetails,
          file_url: currentFile.fileUrl,
          file_size_bytes: currentFile.file.size,
          file_type_mime: currentFile.file.type,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Save failed');
      }
      toast.success(`"${currentDetails.title || currentFile.file.name}" saved`);
      if (goNext && currentIndex < successFiles.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else if (!goNext || currentIndex >= successFiles.length - 1) {
        router.push('/library');
      }
    } catch (err) {
      toast.error('Save failed', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingDetail(false);
    }
  }

  // ── Phase: Select ──────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="space-y-6">
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
          }`}
        >
          <input {...getInputProps()} />
          <Images className={`h-12 w-12 mb-3 ${isDragActive ? 'text-primary' : 'text-muted-foreground/50'}`} />
          {isDragActive ? (
            <p className="text-sm font-medium text-primary">Drop files here</p>
          ) : (
            <>
              <p className="text-sm font-medium">Drag & drop multiple files, or <span className="text-primary">browse</span></p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, GIF, SVG, PSD, MP4, MOV, PPT, PPTX, DOC, DOCX · Max 500 MB each</p>
            </>
          )}
        </div>

        {batchFiles.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{batchFiles.length} file{batchFiles.length !== 1 ? 's' : ''} selected</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {batchFiles.map((bf) => (
                <div key={bf.id} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                  {bf.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bf.previewUrl} alt={bf.file.name} className="h-10 w-10 object-cover rounded shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bf.file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(bf.file.size)}</p>
                  </div>
                  <Select
                    value={bf.contentType}
                    onValueChange={(v) => updateContentType(bf.id, v as ContentTypeEnum)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORTED_CONTENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">{CONTENT_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFile(bf.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={uploadAll} className="bg-[#2323A3] hover:bg-[#2323A3]/90">
                <UploadCloud className="h-4 w-4" />
                Upload {batchFiles.length} File{batchFiles.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Phase: Uploading ───────────────────────────────────────────
  if (phase === 'uploading') {
    const done = batchFiles.filter((f) => f.status === 'uploaded' || f.status === 'error').length;
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Uploading files… {done} / {batchFiles.length}</p>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {batchFiles.map((bf) => (
            <div key={bf.id} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded">
                {bf.status === 'uploaded' && <Check className="h-5 w-5 text-emerald-500" />}
                {bf.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
                {(bf.status === 'uploading' || bf.status === 'pending') && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{bf.file.name}</p>
                {bf.status === 'error' && <p className="text-xs text-destructive">{bf.errorMsg}</p>}
                {bf.status === 'uploading' && bf.uploadProgress !== undefined && (
                  <Progress value={bf.uploadProgress} className="h-1.5 mt-1" />
                )}
              </div>
              <Badge variant={bf.status === 'uploaded' ? 'default' : bf.status === 'error' ? 'destructive' : 'outline'} className="text-xs capitalize shrink-0">
                {bf.status === 'uploaded' ? 'Done' : bf.status === 'uploading' ? `${bf.uploadProgress ?? 0}%` : bf.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Phase: Details ─────────────────────────────────────────────
  if (phase === 'details' && successFiles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p>All uploads failed. Please try again.</p>
        <Button variant="outline" className="mt-4" onClick={() => { setBatchFiles([]); setPhase('select'); }}>
          Start Over
        </Button>
      </div>
    );
  }

  if (phase === 'details' && currentFile && currentDetails) {
    return (
      <div className="space-y-6">
        {/* Progress header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              Item {currentIndex + 1} of {successFiles.length}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{currentFile.file.name}</p>
          </div>
          <div className="flex gap-1">
            {successFiles.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-colors ${i < currentIndex ? 'bg-emerald-500' : i === currentIndex ? 'bg-[#2323A3]' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        {currentFile.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentFile.previewUrl} alt="Preview" className="w-full max-h-48 object-contain rounded-lg bg-muted" />
        )}

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input
              value={currentDetails.title}
              onChange={(e) => updateCurrentDetails({ title: e.target.value })}
              placeholder="Enter a descriptive title"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={currentDetails.description}
              onChange={(e) => updateCurrentDetails({ description: e.target.value })}
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Content Type</Label>
            <Select
              value={currentDetails.content_type}
              onValueChange={(v) => updateCurrentDetails({ content_type: v as ContentTypeEnum })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTED_CONTENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Tags */}
          {productTags.length > 0 && (
            <div className="space-y-2">
              <Label>Product Tags</Label>
              <div className="flex flex-wrap gap-2">
                {productTags.map((tag) => {
                  const checked = currentDetails.product_tags.includes(tag.name);
                  return (
                    <label key={tag.id} className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleTag('product_tags', tag.name)} className="h-3.5 w-3.5" />
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Topic Tags */}
          {topicTags.length > 0 && (
            <div className="space-y-2">
              <Label>Topic Tags</Label>
              <div className="flex flex-wrap gap-2">
                {topicTags.map((tag) => {
                  const checked = currentDetails.topic_tags.includes(tag.name);
                  return (
                    <label key={tag.id} className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleTag('topic_tags', tag.name)} className="h-3.5 w-3.5" />
                      {tag.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Medium Tags */}
          {mediumTags.length > 0 && (
            <div className="space-y-2">
              <Label>Platform / Medium</Label>
              <div className="flex flex-wrap gap-2">
                {mediumTags.map((tag) => {
                  const checked = currentDetails.medium_tags.includes(tag.name);
                  return (
                    <label key={tag.id} className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleTag('medium_tags', tag.name)} className="h-3.5 w-3.5" />
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Audience */}
          <div className="space-y-2">
            <Label>Audience</Label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_TYPES.map((a) => {
                const checked = currentDetails.audience_tags.includes(a);
                return (
                  <label key={a} className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleTag('audience_tags', a)} className="h-3.5 w-3.5" />
                    {AUDIENCE_LABELS[a]}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0 || savingDetail}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => saveCurrentAndNext(true)}
              disabled={!currentDetails.title || savingDetail}
            >
              {savingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {currentIndex < successFiles.length - 1 ? (
                <>Save & Next <ChevronRight className="h-4 w-4" /></>
              ) : (
                <>Save Draft</>
              )}
            </Button>
            <Button
              onClick={() => {
                updateCurrentDetails({ status: 'published' });
                setTimeout(() => saveCurrentAndNext(true), 0);
              }}
              disabled={!currentDetails.title || savingDetail}
              className="bg-[#2323A3] hover:bg-[#2323A3]/90"
            >
              {currentIndex < successFiles.length - 1 ? 'Publish & Next' : 'Publish & Finish'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
