import { useState } from 'react';
import { useAdminListUsers, useAdminInviteUser, useAdminUpdateUser, useAdminRemoveUser, getAdminListUsersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Shield, User, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@clerk/clerk-react';

export default function TeamPage() {
  const { data: users, isLoading, error } = useAdminListUsers();
  const { user: currentUser } = useUser();

  return (
    <AdminLayout title="Team Access">
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground text-sm">Manage staff access and roles.</p>
          <InviteUserDialog />
        </div>

        <Card className="overflow-hidden border-border/50 shadow-sm">
          {error ? (
            <div className="p-8 text-center text-destructive font-mono text-sm">
              Failed to load team: {(error as any)?.data?.error || error.message}
            </div>
          ) : isLoading && !users ? (
            <div className="p-4 space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-[150px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u) => {
                    const isMe = u.clerkUserId === currentUser?.id;
                    return (
                      <TableRow key={u.id} className="hover:bg-primary/5 transition-colors group">
                        <TableCell>
                          <div className="font-bold text-foreground flex items-center gap-2">
                            {u.name || 'Unnamed'}
                            {isMe && <Badge variant="secondary" className="font-mono text-[9px] uppercase">You</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            {u.role === 'owner' && <Shield className="w-4 h-4 text-primary" />}
                            {u.role === 'manager' && <Shield className="w-4 h-4 text-emerald-500" />}
                            {u.role === 'staff' && <User className="w-4 h-4 text-muted-foreground" />}
                            <span className="capitalize">{u.role}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isMe && u.role !== 'owner' && (
                              <>
                                <EditRoleDialog user={u} />
                                <RemoveUserButton user={u} />
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<any>('staff');

  const mutation = useAdminInviteUser();

  const handleSave = () => {
    mutation.mutate({ data: { email, name, role } }, {
      onSuccess: () => {
        toast({ title: 'User Invited', description: 'They will receive an email to join.' });
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        setOpen(false);
        setEmail(''); setName(''); setRole('staff');
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="font-bold tracking-wide"><UserPlus className="w-4 h-4 mr-2" /> Invite Member</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="colleague@evolve.com" />
          </div>
          <div className="space-y-2">
            <Label>Name (optional)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager (Can manage users & settings)</SelectItem>
                <SelectItem value="staff">Staff (Orders, Products, Customers only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending || !email}>Send Invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRoleDialog({ user }: { user: any }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<any>(user.role);

  const mutation = useAdminUpdateUser();

  const handleSave = () => {
    mutation.mutate({ clerkUserId: user.clerkUserId, data: { role } }, {
      onSuccess: () => {
        toast({ title: 'Role Updated' });
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        setOpen(false);
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Edit Role</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role: {user.email}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveUserButton({ user }: { user: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useAdminRemoveUser();

  const handleDelete = () => {
    if (!confirm(`Remove ${user.email} from the workspace?`)) return;
    mutation.mutate({ clerkUserId: user.clerkUserId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
        toast({ title: 'User Removed' });
      },
      onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.data?.error || e.message })
    });
  };

  return (
    <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-destructive/20 hover:text-destructive" onClick={handleDelete} disabled={mutation.isPending}>
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
