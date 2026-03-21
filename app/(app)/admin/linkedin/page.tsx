'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Save, X, Building2, User, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { LinkedInAccount, LinkedInAccountType } from '@/types/database';

interface AccountForm {
  name: string;
  account_type: LinkedInAccountType;
  profile_url: string;
  avatar_url: string;
  is_active: boolean;
}

function emptyForm(): AccountForm {
  return { name: '', account_type: 'personal', profile_url: '', avatar_url: '', is_active: true };
}

export default function AdminLinkedInPage() {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AccountForm>(emptyForm());
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AccountForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    try {
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const { accounts: accs } = await res.json();
        setAccounts(accs || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/linkedin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          account_type: addForm.account_type,
          profile_url: addForm.profile_url || null,
          avatar_url: addForm.avatar_url || null,
          is_active: addForm.is_active,
        }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const { account } = await res.json();
      setAccounts(prev => [...prev, account]);
      setAddForm(emptyForm());
      setShowAdd(false);
      toast.success('Account added');
    } catch {
      toast.error('Failed to add account');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(account: LinkedInAccount) {
    setEditingId(account.id);
    setEditForm({
      name: account.name,
      account_type: account.account_type,
      profile_url: account.profile_url || '',
      avatar_url: account.avatar_url || '',
      is_active: account.is_active,
    });
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/linkedin/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editForm.name.trim(),
          account_type: editForm.account_type,
          profile_url: editForm.profile_url || null,
          avatar_url: editForm.avatar_url || null,
          is_active: editForm.is_active,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const { account } = await res.json();
      setAccounts(prev => prev.map(a => a.id === editingId ? account : a));
      setEditingId(null);
      toast.success('Account updated');
    } catch {
      toast.error('Failed to update account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LinkedIn Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage tracked LinkedIn accounts</p>
        </div>
        <Button onClick={() => setShowAdd(true)} disabled={showAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="border-[#2323A3]/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New LinkedIn Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. John Smith"
                />
              </div>
              <div className="space-y-1">
                <Label>Account Type</Label>
                <Select
                  value={addForm.account_type}
                  onValueChange={v => setAddForm(f => ({ ...f, account_type: v as LinkedInAccountType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal (Founder)</SelectItem>
                    <SelectItem value="company">Company Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Profile URL</Label>
              <Input
                value={addForm.profile_url}
                onChange={e => setAddForm(f => ({ ...f, profile_url: e.target.value }))}
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>
            <div className="space-y-1">
              <Label>Avatar URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={addForm.avatar_url}
                onChange={e => setAddForm(f => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={addForm.is_active}
                onCheckedChange={v => setAddForm(f => ({ ...f, is_active: v }))}
                id="add-is-active"
              />
              <Label htmlFor="add-is-active">Active</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowAdd(false); setAddForm(emptyForm()); }}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No LinkedIn accounts added yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const Icon = account.account_type === 'company' ? Building2 : User;
            const isEditing = editingId === account.id;

            return (
              <Card key={account.id}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            value={editForm.name}
                            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={editForm.account_type}
                            onValueChange={v => setEditForm(f => ({ ...f, account_type: v as LinkedInAccountType }))}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="personal">Personal</SelectItem>
                              <SelectItem value="company">Company</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Profile URL</Label>
                        <Input
                          value={editForm.profile_url}
                          onChange={e => setEditForm(f => ({ ...f, profile_url: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Avatar URL</Label>
                        <Input
                          value={editForm.avatar_url}
                          onChange={e => setEditForm(f => ({ ...f, avatar_url: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editForm.is_active}
                          onCheckedChange={v => setEditForm(f => ({ ...f, is_active: v }))}
                          id={`edit-active-${account.id}`}
                        />
                        <Label htmlFor={`edit-active-${account.id}`} className="text-sm">Active</Label>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="gap-2">
                          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          <Save className="h-3.5 w-3.5" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {account.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={account.avatar_url} alt={account.name} className="w-full h-full object-cover" />
                        ) : (
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{account.name}</p>
                          <Badge variant="outline" className="text-xs capitalize">{account.account_type}</Badge>
                          {!account.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        {account.profile_url && (
                          <a
                            href={account.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <ExternalLink className="h-3 w-3" />
                            LinkedIn profile
                          </a>
                        )}
                      </div>

                      <Button size="sm" variant="ghost" onClick={() => startEdit(account)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
