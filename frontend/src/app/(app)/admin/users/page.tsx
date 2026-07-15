'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/RoleGuard';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '@/lib/api/admin';
import type { AdminUser, UserRole } from '@/lib/types/admin';
import { ROLE_LABELS } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FormData = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

const EMPTY_FORM: FormData = { name: '', email: '', password: '', role: 'driver' };

const ROLE_BADGE: Record<UserRole, string> = {
  admin:    'bg-primary/10 text-primary',
  operator: 'bg-amber-500/10 text-amber-600',
  driver:   'bg-emerald-500/10 text-emerald-600',
};

export default function UsersPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <UsersPageContent />
    </RoleGuard>
  );
}

function UsersPageContent() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form,    setForm]    = useState<FormData>(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);
      setUsers(await listUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErr(null);
    setOpen(true);
  }

  function openEdit(u: AdminUser) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setFormErr(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    try {
      if (editing) {
        const payload: Partial<FormData> = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await updateUser(editing.id, payload);
      } else {
        await createUser(form);
      }
      setOpen(false);
      await load();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (deleting !== id) { setDeleting(id); return; }
    try {
      await deleteUser(id);
      setDeleting(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar.');
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gestión de cuentas y roles</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          Nuevo usuario
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Correo</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Rol</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(u)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`size-7 ${deleting === u.id ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                        onClick={() => void handleDelete(u.id)}
                        title={deleting === u.id ? 'Confirmar eliminación' : 'Eliminar'}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-name">Nombre</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Correo electrónico</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-password">
                  Contraseña{editing ? ' (dejar en blanco para no cambiar)' : ''}
                </Label>
                <Input
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing}
                  minLength={8}
                  placeholder={editing ? '••••••••' : ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Rol</Label>
                <select
                  id="u-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="admin">Administrador</option>
                  <option value="operator">Operador</option>
                  <option value="driver">Conductor</option>
                </select>
              </div>

              {formErr ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</p>
              ) : null}
            </div>

            <DialogFooter className="mt-4" showCloseButton>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
