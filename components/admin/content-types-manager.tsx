'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X, Loader2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ContentTypeRow } from '@/types/database';

// Preset Tailwind color combos (must all be in the build to avoid purge issues)
const COLOR_PRESETS = [
  { label: 'Gray',   classes: 'bg-gray-100 text-gray-700 border-gray-200' },
  { label: 'Red',    classes: 'bg-red-100 text-red-700 border-red-200' },
  { label: 'Rose',   classes: 'bg-rose-100 text-rose-700 border-rose-200' },
  { label: 'Orange', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
  { label: 'Amber',  classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  { label: 'Yellow', classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { label: 'Lime',   classes: 'bg-lime-100 text-lime-700 border-lime-200' },
  { label: 'Green',  classes: 'bg-green-100 text-green-700 border-green-200' },
  { label: 'Teal',   classes: 'bg-teal-100 text-teal-700 border-teal-200' },
  { label: 'Cyan',   classes: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { label: 'Sky',    classes: 'bg-sky-100 text-sky-700 border-sky-200' },
  { label: 'Blue',   classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  { label: 'Indigo', classes: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { label: 'Violet', classes: 'bg-violet-100 text-violet-700 border-violet-200' },
  { label: 'Purple', classes: 'bg-purple-100 text-purple-700 border-purple-200' },
  { label: 'Pink',   classes: 'bg-pink-100 text-pink-700 border-pink-200' },
];

interface ContentTypesManagerProps {
  initialTypes: ContentTypeRow[];
}

interface NewTypeForm {
  key: string;
  label: string;
  color_classes: string;
}

export function ContentTypesManager({ initialTypes }: ContentTypesManagerProps) {
  const [types, setTypes] = useState<ContentTypeRow[]>(
    [...initialTypes].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ContentTypeRow>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<NewTypeForm>({
    key: '',
    label: '',
    color_classes: COLOR_PRESETS[0].classes,
  });
  const [adding, setAdding] = useState(false);

  function startEdit(ct: ContentTypeRow) {
    setEditingId(ct.id);
    setEditValues({ label: ct.label, color_classes: ct.color_classes, sort_order: ct.sort_order });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/content-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editValues }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      setTypes((prev) => prev.map((t) => t.id === id ? { ...t, ...json } : t).sort((a, b) => a.sort_order - b.sort_order));
      setEditingId(null);
      toast.success('Content type updated');
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(ct: ContentTypeRow) {
    try {
      const res = await fetch('/api/admin/content-types', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ct.id, is_active: !ct.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update');
      setTypes((prev) => prev.map((t) => t.id === ct.id ? { ...t, is_active: !ct.is_active } : t));
      toast.success(ct.is_active ? 'Hidden from dropdowns' : 'Now visible in dropdowns');
    } catch (err) {
      toast.error('Update failed', { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function deleteType(id: string) {
    if (!confirm('Delete this content type? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/content-types?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      setTypes((prev) => prev.filter((t) => t.id !== id));
      toast.success('Content type deleted');
    } catch (err) {
      toast.error('Delete failed', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(null);
    }
  }

  async function addType() {
    if (!newForm.key.trim() || !newForm.label.trim()) {
      toast.error('Key and label are required');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/content-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newForm.key.trim().toLowerCase().replace(/\s+/g, '_'),
          label: newForm.label.trim(),
          color_classes: newForm.color_classes,
          sort_order: types.length + 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create');
      setTypes((prev) => [...prev, json].sort((a, b) => a.sort_order - b.sort_order));
      setShowAdd(false);
      setNewForm({ key: '', label: '', color_classes: COLOR_PRESETS[0].classes });
      toast.success(`"${json.label}" created`);
    } catch (err) {
      toast.error('Create failed', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Types</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add, rename, or reorder the content type categories used across the library.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-[#2323A3] hover:bg-[#2323A3]/90" disabled={showAdd}>
          <Plus className="h-4 w-4" />
          Add Type
        </Button>
      </div>

      {/* Add new type form */}
      {showAdd && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="font-semibold text-sm">New Content Type</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-key">Key <span className="text-destructive">*</span></Label>
              <Input
                id="new-key"
                placeholder="e.g. infographic"
                value={newForm.key}
                onChange={(e) => setNewForm((f) => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, underscores. Cannot be changed later.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-label">Display Name <span className="text-destructive">*</span></Label>
              <Input
                id="new-label"
                placeholder="e.g. Infographic"
                value={newForm.label}
                onChange={(e) => setNewForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Badge Colour</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.classes}
                  type="button"
                  onClick={() => setNewForm((f) => ({ ...f, color_classes: preset.classes }))}
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-all ${preset.classes} ${
                    newForm.color_classes === preset.classes ? 'ring-2 ring-offset-1 ring-foreground' : ''
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={addType} disabled={adding} size="sm" className="bg-[#2323A3] hover:bg-[#2323A3]/90">
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Create
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setNewForm({ key: '', label: '', color_classes: COLOR_PRESETS[0].classes }); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Types table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8"></th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Key</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Display Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Badge</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell w-20">Order</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-28">Status</th>
              <th className="px-4 py-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {types.map((ct) => (
              <tr key={ct.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-muted-foreground/40">
                  <GripVertical className="h-4 w-4" />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ct.key}</td>
                <td className="px-4 py-3">
                  {editingId === ct.id ? (
                    <Input
                      value={editValues.label ?? ct.label}
                      onChange={(e) => setEditValues((v) => ({ ...v, label: e.target.value }))}
                      className="h-7 text-sm w-40"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium">{ct.label}</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {editingId === ct.id ? (
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.classes}
                          type="button"
                          onClick={() => setEditValues((v) => ({ ...v, color_classes: preset.classes }))}
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${preset.classes} ${
                            (editValues.color_classes ?? ct.color_classes) === preset.classes ? 'ring-2 ring-offset-1 ring-foreground' : ''
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ct.color_classes}`}>
                      {ct.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {editingId === ct.id ? (
                    <Input
                      type="number"
                      value={editValues.sort_order ?? ct.sort_order}
                      onChange={(e) => setEditValues((v) => ({ ...v, sort_order: parseInt(e.target.value) || 0 }))}
                      className="h-7 text-sm w-16"
                    />
                  ) : (
                    <span className="text-muted-foreground">{ct.sort_order}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={ct.is_active ? 'outline' : 'secondary'} className="text-xs">
                    {ct.is_active ? 'Active' : 'Hidden'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {editingId === ct.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => saveEdit(ct.id)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleActive(ct)}
                          title={ct.is_active ? 'Hide from dropdowns' : 'Show in dropdowns'}
                        >
                          {ct.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(ct)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteType(ct.id)}
                          disabled={deleting === ct.id}
                        >
                          {deleting === ct.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {types.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No content types yet. Run migration 004 in Supabase SQL Editor first, then click &quot;Add Type&quot;.
          </div>
        )}
      </div>

      <Separator />
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <p className="font-medium mb-1">Before adding new types</p>
        <p>Run <strong>migration 004</strong> in your Supabase SQL Editor if you haven&apos;t already. This converts
        the content type column to free text and creates this registry table.</p>
      </div>
    </div>
  );
}
