'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { UserRow, UserRoleEnum } from '@/types/database';

const ROLE_LABELS: Record<UserRoleEnum, string> = {
  admin: 'Admin',
  marketing: 'Marketing',
  sales: 'Sales',
  distributor: 'Distributor',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<UserRoleEnum, string> = {
  admin: 'bg-[#2323A3]/10 text-[#2323A3] border-[#2323A3]/20',
  marketing: 'bg-purple-100 text-purple-700 border-purple-200',
  sales: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  distributor: 'bg-amber-100 text-amber-700 border-amber-200',
  viewer: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface UsersManagerProps {
  users: (UserRow & { email?: string })[];
  currentUserId: string;
}

export function UsersManager({ users, currentUserId }: UsersManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRoleEnum>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  const supabase = createClient();

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError(null);

    try {
      // Use Supabase admin invite via our API route
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const json = await res.json();
      if (!res.ok) {
        setInviteError(json.error || 'Failed to send invitation. Check your Supabase email settings.');
        return;
      }

      setInviteSent(true);
      toast.success(`Invitation sent to ${inviteEmail}`);
      startTransition(() => router.refresh());
    } catch (err: any) {
      setInviteError(err.message || 'Network error. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: UserRoleEnum) {
    if (userId === currentUserId && newRole !== 'admin') {
      toast.error('You cannot change your own admin role.');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update role', { description: error.message });
    } else {
      toast.success('Role updated');
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite team members and manage their access roles.
          </p>
        </div>
        <Button onClick={() => { setInviteOpen(true); setInviteSent(false); setInviteEmail(''); setInviteError(null); }} className="bg-[#2323A3] hover:bg-[#2323A3]/90">
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Change Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No users yet. Invite your first team member.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const initials = user.full_name
                  ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                  : (user.email?.[0] || 'U').toUpperCase();

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback className="bg-[#2323A3]/10 text-[#2323A3] text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{user.full_name || 'Unknown'}</p>
                          {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                        </div>
                        {user.id === currentUserId && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={user.role}
                        onValueChange={(v) => handleRoleChange(user.id, v as UserRoleEnum)}
                        disabled={user.id === currentUserId}
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as UserRoleEnum[]).map((role) => (
                            <SelectItem key={role} value={role} className="text-xs">
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => !inviting && setInviteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They'll receive a magic link email to sign in. You can assign their role here.
            </DialogDescription>
          </DialogHeader>

          {inviteSent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
              <p className="font-medium">Invitation sent!</p>
              <p className="text-sm text-muted-foreground">
                A sign-in link has been sent to <strong>{inviteEmail}</strong>.
              </p>
              <Button variant="outline" size="sm" onClick={() => { setInviteSent(false); setInviteEmail(''); }}>
                Invite another
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {inviteError && (
                <div className="flex items-start gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {inviteError}
                </div>
              )}

              <div className="space-y-2">
                <Label>Email address</Label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRoleEnum)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as UserRoleEnum[]).map((role) => (
                      <SelectItem key={role} value={role}>
                        <div>
                          <p>{ROLE_LABELS[role]}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!inviteSent && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
              <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="bg-[#2323A3] hover:bg-[#2323A3]/90">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Send Invitation
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
