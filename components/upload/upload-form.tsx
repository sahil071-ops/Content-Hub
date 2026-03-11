'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, Globe, Upload, FileText } from 'lucide-react';
import Image from 'next/image';

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

import { CONTENT_TYPE_LABELS, AUDIENCE_LABELS, buildFilePath } from '@/lib/utils';
import type { ContentTypeEnum, AudienceTagEnum, TagRow } from '@/types/database';

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentTypeEnum[];
const AUDIENCE_TYPES = Object.keys(AUDIENCE_LABELS) as AudienceTagEnum[];

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  content_type: z.enum(['video', 'pdf', 'image', 'presentation', 'emailer', 'blog', 'whitepaper', 'ebook', 'other'] as const),
  status: z.enum(['draft', 'published']),
  product_tags: z.array(z.string()).default([]),
  topic_tags: z.array(z.string()).default([]),
  audience_tags: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof schema>;

interface UploadFormProps {
  productTags: TagRow[];
  topicTags: TagRow[];
}

export function UploadForm({ productTags, topicTags }: UploadFormProps) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [youtubeData, setYoutubeData] = useState<any>(null);
  const [blogData, setBlogData] = useState<ArchivedBlogData | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      content_type: 'pdf',
      status: 'draft',
      product_tags: [],
      topic_tags: [],
      audience_tags: [],
    },
  });

  const contentType = watch('content_type');
  const isVideo = contentType === 'video';
  const isBlog = contentType === 'blog';

  async function handleFileAccepted(f: File) {
    setFile(f);

    // Auto-generate PDF thumbnail
    if (f.type === 'application/pdf') {
      const thumb = await generatePdfThumbnail(f);
      if (thumb) setThumbnailDataUrl(thumb);
    }
  }

  function toggleArrayValue(field: 'product_tags' | 'topic_tags' | 'audience_tags', value: string) {
    const current = watch(field) as string[];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setValue(field, updated);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setSubmitError(null);

    try {
      let fileUrl: string | undefined;
      let filePath: string | undefined;
      let thumbnailUrl: string | undefined;

      // ── Step 1: Upload file to R2 (if file selected) ──────────
      if (file) {
        // Get presigned URL
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
          setSubmitError(presignJson.error || 'Failed to prepare file upload. Check your R2 credentials.');
          return;
        }

        const { upload_url, file_path, public_url } = presignJson;
        filePath = file_path;
        fileUrl = public_url;

        // Upload with progress tracking via XMLHttpRequest
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`R2 upload failed with status ${xhr.status}. Check your R2 credentials and bucket configuration.`));
          };
          xhr.onerror = () => reject(new Error('Network error during file upload. Please check your connection and try again.'));
          xhr.open('PUT', upload_url);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        // Upload PDF thumbnail if generated
        if (thumbnailDataUrl && file.type === 'application/pdf') {
          const thumbBlob = await dataUrlToBlob(thumbnailDataUrl);
          const thumbPresignRes = await fetch('/api/upload/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: `thumb-${file.name}.jpg`,
              content_type_mime: 'image/jpeg',
              content_type: 'image',
            }),
          });
          if (thumbPresignRes.ok) {
            const { upload_url: thumbUploadUrl, public_url: thumbPublicUrl } = await thumbPresignRes.json();
            await fetch(thumbUploadUrl, { method: 'PUT', body: thumbBlob, headers: { 'Content-Type': 'image/jpeg' } });
            thumbnailUrl = thumbPublicUrl;
          }
        }
      }

      // ── Step 2: Build meta object ──────────────────────────────
      const meta: Record<string, unknown> = {};
      if (youtubeData) meta.youtube = youtubeData;
      if (blogData) meta.archived_blog = blogData;

      // ── Step 3: Save to database ───────────────────────────────
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          file_url: fileUrl,
          file_path: filePath,
          external_link: youtubeData
            ? `https://youtube.com/watch?v=${youtubeData.video_id}`
            : blogData?.url,
          thumbnail_url: thumbnailUrl || youtubeData?.thumbnail_url,
          file_size_bytes: file?.size,
          file_type_mime: file?.type,
          meta,
        }),
      });

      const completeJson = await completeRes.json();
      if (!completeRes.ok) {
        setSubmitError(completeJson.error || 'Failed to save content metadata. Please try again.');
        return;
      }

      const { id: newId } = completeJson;

      // ── Step 4: Trigger async B2 backup (fire and forget) ─────
      if (fileUrl && filePath) {
        fetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_id: newId, file_url: fileUrl, file_path: filePath, file_type: file?.type }),
        }).catch(() => {
          // Backup is non-blocking — failure is logged server-side
        });
      }

      toast.success('Content saved!', {
        description: values.status === 'published' ? 'Published successfully.' : 'Saved as draft.',
      });
      router.push(`/library/${newId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setSubmitError(msg);
      toast.error('Upload failed', { description: msg });
    } finally {
      setSubmitting(false);
      setUploadProgress(undefined);
    }
  }

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
            defaultValue="pdf"
            onValueChange={(val) => {
              setValue('content_type', val as ContentTypeEnum);
              setFile(null);
              setYoutubeData(null);
              setBlogData(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      {/* ── File / URL Input ─────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {isVideo ? 'Video Link' : isBlog ? 'File or Blog URL' : 'File'}
        </h2>

        {isVideo ? (
          <YouTubeInput onData={setYoutubeData} data={youtubeData} />
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
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">and / or</span>
              </div>
            </div>
            <BlogUrlInput onData={setBlogData} data={blogData} />
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

        {/* Thumbnail preview */}
        {thumbnailDataUrl && (
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <img src={thumbnailDataUrl} alt="Auto-generated thumbnail" className="h-16 w-24 object-cover rounded" />
            <div>
              <p className="text-xs font-medium">PDF thumbnail auto-generated</p>
              <p className="text-xs text-muted-foreground">First page preview will be shown in the library.</p>
            </div>
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
            defaultValue={youtubeData?.title || blogData?.title || ''}
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
            defaultValue={blogData?.description || ''}
          />
        </div>
      </section>

      <Separator />

      {/* ── Tags ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tags</h2>

        {/* Product Tags */}
        {productTags.length > 0 && (
          <div className="space-y-2">
            <Label>Product Tags</Label>
            <div className="flex flex-wrap gap-2">
              {productTags.map((tag) => {
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
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
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
            </div>
          </div>
        )}

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
            Publish
          </Button>
        </div>
      </section>
    </form>
  );
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
