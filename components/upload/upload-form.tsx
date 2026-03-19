'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, Upload, Plus, X, Check, Paperclip, File as FileIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { UploadZone } from '@/components/upload/upload-zone';
import { YouTubeInput } from '@/components/upload/youtube-input';
import { BlogUrlInput, type ArchivedBlogData } from '@/components/upload/blog-url-input';
import { generatePdfThumbnail } from '@/components/content/pdf-viewer';
import { createClient } from '@/lib/supabase/client';

import { CONTENT_TYPE_LABELS, AUDIENCE_LABELS, SORTED_CONTENT_TYPES } from '@/lib/utils';
import type { AudienceTagEnum, TagRow, ContentItem, ContentTypeRow } from '@/types/database';

const AUDIENCE_TYPES = Object.keys(AUDIENCE_LABELS) as AudienceTagEnum[];

const TAG_PRESET_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#3D3D3D',
];

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  content_type: z.string().min(1, 'Content type is required'),
  status: z.enum(['draft', 'published']),
  product_tags: z.array(z.string()).default([]),
  topic_tags: z.array(z.string()).default([]),
  audience_tags: z.array(z.string()).default([]),
  medium_tags: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

interface UploadFormProps {
  productTags: TagRow[];
  topicTags: TagRow[];
  mediumTags: TagRow[];
  userRole: 'admin' | 'marketing';
  initialData?: ContentItem | null;
  contentTypes?: ContentTypeRow[];
}

export function UploadForm({ productTags, topicTags, mediumTags, userRole, initialData, contentTypes }: UploadFormProps) {
  // Build the list of content types to display — dynamic from DB or static fallback
  const contentTypeList = contentTypes && contentTypes.length > 0
    ? contentTypes.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order)
    : SORTED_CONTENT_TYPES.map((k) => ({ key: k, label: CONTENT_TYPE_LABELS[k] ?? k }));
  const router = useRouter();
  const isEdit = !!initialData;

  // ── File / media states ────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [existingFileUrl] = useState<string | null>(initialData?.file_url || null);
  const [existingThumbnailUrl] = useState<string | null>(initialData?.thumbnail_url || null);
  // Additional files (multi-file feature)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [existingFileUrls, setExistingFileUrls] = useState<string[]>((initialData as any)?.file_urls || []);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  // Initialise YouTube data from existing item
  const initYoutubeData = initialData?.content_type === 'video' && initialData.meta?.youtube
    ? { ...(initialData.meta.youtube as any), title: (initialData.meta.youtube as any).title || initialData.title }
    : null;
  const [youtubeData, setYoutubeData] = useState<any>(initYoutubeData);

  // Initialise blog data from existing item
  const [blogData, setBlogData] = useState<ArchivedBlogData | null>(
    (initialData?.meta?.archived_blog as ArchivedBlogData) || null
  );

  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Tag states ─────────────────────────────────────────────────
  const [allProductTags, setAllProductTags] = useState<TagRow[]>(productTags);
  const [allTopicTags, setAllTopicTags] = useState<TagRow[]>(topicTags);
  const [allMediumTags, setAllMediumTags] = useState<TagRow[]>(mediumTags);
  const [newTagInput, setNewTagInput] = useState<{ type: 'product' | 'topic' | 'medium'; name: string; color: string } | null>(null);
  const [tagCreating, setTagCreating] = useState(false);

  // ── Form ───────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      content_type: initialData?.content_type || 'pdf',
      status: initialData?.status === 'published' ? 'published' : 'draft',
      product_tags: initialData?.product_tags || [],
      topic_tags: initialData?.topic_tags || [],
      audience_tags: (initialData?.audience_tags || []) as string[],
      medium_tags: (initialData as any)?.medium_tags || [],
    },
  });

  const contentType = watch('content_type');
  const isYouTube = contentType === 'video';
  const isVideo = isYouTube;
  const isBlog = contentType === 'blog';

  // Track whether the form has unsaved content
  const [isDirty, setIsDirty] = useState(false);

  // Mark dirty as soon as a file is added or youtube/blog data is loaded
  useEffect(() => {
    if (file || youtubeData || blogData || additionalFiles.length > 0) setIsDirty(true);
  }, [file, youtubeData, blogData, additionalFiles.length]);

  // Warn before closing tab with unsaved data
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !submitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, submitting]);

  // ── Handlers ───────────────────────────────────────────────────

  // Types that are "compatible" with a given MIME category — don't auto-override these
  const IMAGE_COMPATIBLE = new Set(['image', 'poster', 'graphic', 'flier', 'catalogue', 'emailer']);
  const VIDEO_COMPATIBLE = new Set(['video', 'video_file']);
  const PDF_COMPATIBLE = new Set(['pdf', 'whitepaper', 'ebook']);
  const PRESENTATION_COMPATIBLE = new Set(['presentation']);

  async function handleFileAccepted(f: File) {
    setFile(f);
    // Auto-detect content type from MIME only if current type is incompatible with the file
    const currentType = watch('content_type');
    if (f.type.startsWith('image/')) {
      if (!IMAGE_COMPATIBLE.has(currentType)) setValue('content_type', 'image');
    } else if (f.type.startsWith('video/')) {
      if (!VIDEO_COMPATIBLE.has(currentType)) setValue('content_type', 'video_file');
    } else if (f.type === 'application/pdf') {
      if (!PDF_COMPATIBLE.has(currentType)) setValue('content_type', 'pdf');
    } else if (
      f.type === 'application/vnd.ms-powerpoint' ||
      f.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      if (!PRESENTATION_COMPATIBLE.has(currentType)) setValue('content_type', 'presentation');
    }
    // Always generate PDF thumbnail regardless of whether type was manually set
    if (f.type === 'application/pdf') {
      const thumb = await generatePdfThumbnail(f);
      if (thumb) setThumbnailDataUrl(thumb);
    }
  }

  function toggleArrayValue(field: 'product_tags' | 'topic_tags' | 'audience_tags' | 'medium_tags', value: string) {
    const current = watch(field) as string[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setValue(field, updated);
  }

  function handleYoutubeData(data: any) {
    setYoutubeData(data);
    if (data) {
      if (!watch('title') && data.title) setValue('title', data.title, { shouldValidate: true, shouldDirty: true });
      if (!watch('description') && data.description) setValue('description', data.description, { shouldValidate: true, shouldDirty: true });
    }
  }

  function handleBlogData(data: ArchivedBlogData | null) {
    setBlogData(data);
    if (data) {
      if (!watch('title') && data.title) setValue('title', data.title, { shouldValidate: true, shouldDirty: true });
      if (!watch('description') && data.description) setValue('description', data.description, { shouldValidate: true, shouldDirty: true });
    }
  }

  async function createTag() {
    if (!newTagInput?.name.trim()) return;
    setTagCreating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tags_master')
        .insert({ name: newTagInput.name.trim(), tag_type: newTagInput.type, color: newTagInput.color })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      if (data) {
        if (newTagInput.type === 'product') {
          setAllProductTags(prev => [...prev, data as TagRow].sort((a, b) => a.name.localeCompare(b.name)));
          toggleArrayValue('product_tags', data.name);
        } else if (newTagInput.type === 'medium') {
          setAllMediumTags(prev => [...prev, data as TagRow].sort((a, b) => a.name.localeCompare(b.name)));
          toggleArrayValue('medium_tags', data.name);
        } else {
          setAllTopicTags(prev => [...prev, data as TagRow].sort((a, b) => a.name.localeCompare(b.name)));
          toggleArrayValue('topic_tags', data.name);
        }
        toast.success(`Tag "${data.name}" created`);
        setNewTagInput(null);
      }
    } catch (err) {
      toast.error('Failed to create tag', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setTagCreating(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      let fileUrl: string | undefined = existingFileUrl || undefined;
      let thumbnailUrl: string | undefined =
        existingThumbnailUrl ||
        youtubeData?.thumbnail_url ||
        (blogData?.og_image ? blogData.og_image : undefined) ||
        undefined;

      // ── Upload new file to R2 (only if a new file was selected) ──
      if (file) {
        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            content_type_mime: file.type,
            content_type: values.content_type,
          }),
        });
        const presignJson = await presignRes.json();
        if (!presignRes.ok) {
          setSubmitError(presignJson.error || 'Failed to prepare file upload.');
          return;
        }
        const { upload_url, public_url } = presignJson;
        fileUrl = public_url;

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
          xhr.onerror = () => reject(new Error('Network error during upload.'));
          xhr.open('PUT', upload_url);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        if (thumbnailDataUrl && file.type === 'application/pdf') {
          const thumbBlob = await dataUrlToBlob(thumbnailDataUrl);
          const thumbPresignRes = await fetch('/api/upload/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: `thumb-${file.name}.jpg`, content_type_mime: 'image/jpeg', content_type: 'image' }),
          });
          if (thumbPresignRes.ok) {
            const { upload_url: tUrl, public_url: tPublicUrl } = await thumbPresignRes.json();
            await fetch(tUrl, { method: 'PUT', body: thumbBlob, headers: { 'Content-Type': 'image/jpeg' } });
            thumbnailUrl = tPublicUrl;
          }
        }
      }

      // ── Upload additional files to R2 ─────────────────────────
      const additionalFileUrls: string[] = [...existingFileUrls];
      for (const addFile of additionalFiles) {
        const presignRes = await fetch('/api/upload/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: addFile.name,
            content_type_mime: addFile.type,
            content_type: values.content_type,
          }),
        });
        const presignJson = await presignRes.json();
        if (!presignRes.ok) continue; // skip failed files, don't block whole submit
        await fetch(presignJson.upload_url, { method: 'PUT', body: addFile, headers: { 'Content-Type': addFile.type } });
        additionalFileUrls.push(presignJson.public_url);
      }

      // ── Build meta ──────────────────────────────────────────────
      const meta: Record<string, unknown> = isEdit ? { ...(initialData?.meta || {}) } : {};
      if (youtubeData) meta.youtube = youtubeData;
      else if (isVideo) delete meta.youtube;
      if (blogData) meta.archived_blog = blogData;
      else if (isBlog) delete meta.archived_blog;

      const externalLink = youtubeData
        ? `https://youtube.com/watch?v=${youtubeData.video_id}`
        : blogData?.url || (isEdit ? initialData?.external_link : undefined);

      const body = {
        ...(isEdit && { id: initialData!.id }),
        ...values,
        file_url: fileUrl,
        file_urls: additionalFileUrls,
        external_link: externalLink,
        thumbnail_url: thumbnailUrl,
        file_size_bytes: file?.size ?? (isEdit ? initialData?.file_size_bytes ?? undefined : undefined),
        file_type_mime: file?.type ?? (isEdit ? initialData?.file_type ?? undefined : undefined),
        medium_tags: values.medium_tags,
        meta,
      };

      const completeRes = await fetch('/api/upload/complete', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const completeJson = await completeRes.json();
      if (!completeRes.ok) {
        const errMsg = completeJson.error || 'Failed to save content.';
        const errDetail = completeJson.detail ? `\n\nDetail: ${completeJson.detail}` : '';
        setSubmitError(errMsg + errDetail);
        return;
      }

      const { id: savedId } = completeJson;

      // Trigger B2 backup for new uploads only
      if (!isEdit && fileUrl && file) {
        fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_id: savedId, file_url: fileUrl, file_type: file.type }),
        }).catch(() => {});
      }

      toast.success(isEdit ? 'Content updated!' : 'Content saved!', {
        description: values.status === 'published' ? 'Published successfully.' : 'Saved as draft.',
      });
      router.push(`/library/${savedId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setSubmitError(msg);
      toast.error(isEdit ? 'Update failed' : 'Upload failed', { description: msg });
    } finally {
      setSubmitting(false);
      setUploadProgress(undefined);
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm whitespace-pre-wrap">{submitError}</AlertDescription>
        </Alert>
      )}

      {/* ── Content Type ─────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Content Type</h2>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={contentType}
            onValueChange={(val) => {
              setValue('content_type', val);
              setFile(null);
              setYoutubeData(null);
              setBlogData(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contentTypeList.map((t) => (
                <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      {/* ── File / URL Input ─────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {isYouTube ? 'YouTube Link' : isBlog ? 'File or Blog URL' : 'File'}
        </h2>

        {isEdit && existingFileUrl && !file && !isVideo && !isBlog && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border">
            <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Existing file attached. Upload a new file below to replace it.</span>
          </div>
        )}

        {isYouTube ? (
          <YouTubeInput onData={handleYoutubeData} data={youtubeData} />
        ) : isBlog ? (
          <div className="space-y-4">
            <UploadZone
              onFileAccepted={handleFileAccepted}
              file={file}
              onClear={() => { setFile(null); setThumbnailDataUrl(null); }}
              uploadProgress={uploadProgress}
              disabled={submitting}
            />
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">and / or</span>
              </div>
            </div>
            <BlogUrlInput onData={handleBlogData} data={blogData} />
          </div>
        ) : (
          <UploadZone
            onFileAccepted={handleFileAccepted}
            file={file}
            onClear={() => { setFile(null); setThumbnailDataUrl(null); }}
            uploadProgress={uploadProgress}
            disabled={submitting}
          />
        )}

        {thumbnailDataUrl && (
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <img src={thumbnailDataUrl} alt="Auto-generated thumbnail" className="h-16 w-24 object-cover rounded" />
            <div>
              <p className="text-xs font-medium">PDF thumbnail auto-generated</p>
              <p className="text-xs text-muted-foreground">First page preview will be shown in the library.</p>
            </div>
          </div>
        )}

        {/* ── Additional Files ──────────────────────────────────── */}
        {!isYouTube && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Additional files (optional)</Label>
              <button
                type="button"
                onClick={() => additionalFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Paperclip className="h-3 w-3" />
                Add files
              </button>
              <input
                ref={additionalFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setAdditionalFiles((prev) => [...prev, ...files]);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Show existing URLs (when editing) */}
            {existingFileUrls.length > 0 && (
              <div className="space-y-1">
                {existingFileUrls.map((url, i) => (
                  <div key={url} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                    <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1 text-muted-foreground">{url.split('/').pop()}</span>
                    <button
                      type="button"
                      onClick={() => setExistingFileUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Show newly selected files */}
            {additionalFiles.length > 0 && (
              <div className="space-y-1">
                {additionalFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                    {f.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-6 w-6 object-cover rounded shrink-0" />
                    ) : (
                      <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setAdditionalFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <Separator />

      {/* ── Metadata ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Details</h2>

        <div className="space-y-2">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input
            id="title"
            placeholder="Enter a descriptive title"
            {...register('title')}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Brief description of this content (optional)"
            rows={3}
            {...register('description')}
          />
        </div>
      </section>

      <Separator />

      {/* ── Tags ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tags</h2>

        {/* Product Tags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Product Tags</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setNewTagInput({ type: 'product', name: '', color: TAG_PRESET_COLORS[0] })}
            >
              <Plus className="h-3 w-3" /> New tag
            </Button>
          </div>

          {newTagInput?.type === 'product' && (
            <InlineTagForm
              value={newTagInput}
              onChange={(v) => setNewTagInput(prev => prev ? { ...prev, ...v } : null)}
              onSubmit={createTag}
              onCancel={() => setNewTagInput(null)}
              loading={tagCreating}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {allProductTags.map((tag) => {
              const checked = (watch('product_tags') as string[]).includes(tag.name);
              return (
                <label
                  key={tag.id}
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleArrayValue('product_tags', tag.name)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </label>
              );
            })}
            {allProductTags.length === 0 && newTagInput?.type !== 'product' && (
              <p className="text-xs text-muted-foreground">No product tags yet. Click &quot;New tag&quot; to add one.</p>
            )}
          </div>
        </div>

        {/* Topic Tags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Topic Tags</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setNewTagInput({ type: 'topic', name: '', color: TAG_PRESET_COLORS[1] })}
            >
              <Plus className="h-3 w-3" /> New tag
            </Button>
          </div>

          {newTagInput?.type === 'topic' && (
            <InlineTagForm
              value={newTagInput}
              onChange={(v) => setNewTagInput(prev => prev ? { ...prev, ...v } : null)}
              onSubmit={createTag}
              onCancel={() => setNewTagInput(null)}
              loading={tagCreating}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {allTopicTags.map((tag) => {
              const checked = (watch('topic_tags') as string[]).includes(tag.name);
              return (
                <label
                  key={tag.id}
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleArrayValue('topic_tags', tag.name)}
                    className="h-3.5 w-3.5"
                  />
                  {tag.name}
                </label>
              );
            })}
            {allTopicTags.length === 0 && newTagInput?.type !== 'topic' && (
              <p className="text-xs text-muted-foreground">No topic tags yet. Click &quot;New tag&quot; to add one.</p>
            )}
          </div>
        </div>

        {/* Medium Tags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Platform / Medium</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setNewTagInput({ type: 'medium', name: '', color: TAG_PRESET_COLORS[2] })}
            >
              <Plus className="h-3 w-3" /> New tag
            </Button>
          </div>

          {newTagInput?.type === 'medium' && (
            <InlineTagForm
              value={newTagInput}
              onChange={(v) => setNewTagInput(prev => prev ? { ...prev, ...v } : null)}
              onSubmit={createTag}
              onCancel={() => setNewTagInput(null)}
              loading={tagCreating}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {allMediumTags.map((tag) => {
              const checked = (watch('medium_tags') as string[]).includes(tag.name);
              return (
                <label
                  key={tag.id}
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleArrayValue('medium_tags', tag.name)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </label>
              );
            })}
            {allMediumTags.length === 0 && newTagInput?.type !== 'medium' && (
              <p className="text-xs text-muted-foreground">No platform tags yet. Click &quot;New tag&quot; to add one (e.g. Instagram, LinkedIn, Email).</p>
            )}
          </div>
        </div>

        {/* Audience Tags */}
        <div className="space-y-2">
          <Label>Audience</Label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_TYPES.map((audience) => {
              const checked = (watch('audience_tags') as string[]).includes(audience);
              return (
                <label
                  key={audience}
                  className={`flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleArrayValue('audience_tags', audience)}
                    className="h-3.5 w-3.5"
                  />
                  {AUDIENCE_LABELS[audience]}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Status & Submit ───────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Label>Publish status</Label>
          <p className="text-xs text-muted-foreground">
            Drafts are not visible to sales or distributor users.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="submit"
            variant="outline"
            disabled={submitting}
            onClick={() => setValue('status', 'draft')}
          >
            {submitting && watch('status') === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save as Draft
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            onClick={() => setValue('status', 'published')}
            className="bg-[#2323A3] hover:bg-[#2323A3]/90"
          >
            {submitting && watch('status') === 'published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isEdit ? 'Update & Publish' : 'Publish'}
          </Button>
        </div>
      </section>
    </form>
  );
}

// ── Inline tag creation form ──────────────────────────────────────

interface InlineTagFormProps {
  value: { name: string; color: string };
  onChange: (v: Partial<{ name: string; color: string }>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
}

function InlineTagForm({ value, onChange, onSubmit, onCancel, loading }: InlineTagFormProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
      <Input
        placeholder="Tag name"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
          if (e.key === 'Escape') onCancel();
        }}
        className="h-7 text-sm flex-1"
        autoFocus
      />
      <div className="flex gap-1 shrink-0">
        {['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3D3D3D'].map((c) => (
          <button
            key={c}
            type="button"
            className={`h-5 w-5 rounded-full border-2 transition-transform ${value.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
            onClick={() => onChange({ color: c })}
          />
        ))}
      </div>
      <Button type="button" size="sm" className="h-7 px-2" onClick={onSubmit} disabled={loading || !value.name.trim()}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onCancel}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
