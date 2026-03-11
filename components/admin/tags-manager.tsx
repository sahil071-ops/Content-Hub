'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import type { TagRow, TagTypeEnum } from '@/types/database';

const TAG_TYPE_LABELS: Record<TagTypeEnum, string> = {
  product: 'Product',
  topic: 'Topic',
  audience: 'Audience',
  content_type: 'Content Type',
};

const DEFAULT_COLORS = [
  '#2323A3', '#59A7F1', '#3D3D3D', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

interface TagsManagerProps {
  initialTags: TagRow[];
}

interface TagDialogState {
  open: boolean;
  tag: TagRow | null;
}

export function TagsManager({ initialTags }: TagsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<TagDialogState>({ open: false, tag: null });
  const [deleteTag, setDeleteTag] = useState<TagRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', tag_type: 'product' as TagTypeEnum, color: '#2323A3' });
  const [formError, setFormError] = useState<string | null>(null);

  const supabase = createClient();

  function openCreate() {
    setFormData({ name: '', tag_type: 'product', color: '#2323A3' });
    setFormError(null);
    setDialog({ open: true, tag: null });
  }

  function openEdit(tag: TagRow) {
    setFormData({ name: tag.name, tag_type: tag.tag_type, color: tag.color });
    setFormError(null);
    setDialog({ open: true, tag });
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      setFormError('Tag name is required.');
      return;
    }
    setSaving(true);
    setFormError(null);

    try {
      if (dialog.tag) {
        const { error } = await supabase
          .from('tags_master')
          .update({ name: formData.name, tag_type: formData.tag_type, color: formData.color })
          .eq('id', dialog.tag.id);
        if (error) throw error;
        toast.success('Tag updated');
      } else {
        const { error } = await supabase
          .from('tags_master')
          .insert({ name: formData.name, tag_type: formData.tag_type, color: formData.color });
        if (error) {
          if (error.code === '23505') {
            setFormError('A tag with this name and type already exists.');
            return;
          }
          throw error;
        }
        toast.success('Tag created');
      }

      setDialog({ open: false, tag: null });
      startTransition(() => router.refresh());
    } catch (err: any) {
      setFormError(err.message || 'Failed to save tag. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTag) return;

    // Check if tag is in use
    const { count: productCount } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .contains('product_tags', [deleteTag.name]);

    const { count: topicCount } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .contains('topic_tags', [deleteTag.name]);

    const totalUsage = (productCount || 0) + (topicCount || 0);
    if (totalUsage > 0) {
      toast.error(`Cannot delete "${deleteTag.name}"`, {
        description: `This tag is used by ${totalUsage} content item${totalUsage === 1 ? '' : 's'}. Remove the tag from all content before deleting.`,
      });
      setDeleteTag(null);
      return;
    }

    const { error } = await supabase.from('tags_master').delete().eq('id', deleteTag.id);
    if (error) {
      toast.error('Delete failed', { description: error.message });
    } else {
      toast.success(`Tag "${deleteTag.name}" deleted`);
      startTransition(() => router.refresh());
    }
    setDeleteTag(null);
  }

  // Group tags by type
  const grouped = initialTags.reduce((acc, tag) => {
    if (!acc[tag.tag_type]) acc[tag.tag_type] = [];
    acc[tag.tag_type].push(tag);
    return acc;
  }, {} as Record<TagTypeEnum, TagRow[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tag Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage product, topic, and other tags used to organise content.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#2323A3] hover:bg-[#2323A3]/90">
          <Plus className="h-4 w-4" />
          New Tag
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Colour</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialTags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No tags yet. Create your first tag to get started.
                </TableCell>
              </TableRow>
            ) : (
              initialTags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0 border"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TAG_TYPE_LABELS[tag.tag_type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono text-muted-foreground">{tag.color}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tag)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTag(tag)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialog.open} onOpenChange={(open) => !saving && setDialog({ open, tag: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.tag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label>Tag Name</Label>
              <Input
                placeholder="e.g. Variable Speed Drives"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.tag_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, tag_type: v as TagTypeEnum }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TAG_TYPE_LABELS) as TagTypeEnum[]).map((t) => (
                    <SelectItem key={t} value={t}>{TAG_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, color }))}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
                    className="h-7 w-7 rounded cursor-pointer border"
                    title="Custom colour"
                  />
                  <span className="text-xs font-mono text-muted-foreground">{formData.color}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, tag: null })} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#2323A3] hover:bg-[#2323A3]/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {dialog.tag ? 'Save Changes' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTag} onOpenChange={(open) => !open && setDeleteTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to delete the tag <strong>"{deleteTag?.name}"</strong>. This will check
              if the tag is in use — if it is, deletion will be blocked with an explanation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
