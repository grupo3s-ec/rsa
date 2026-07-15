'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/RoleGuard';
import {
  createPredefinedRoute,
  deletePredefinedRoute,
  listPredefinedRoutes,
  updatePredefinedRoute,
} from '@/lib/api/admin';
import type { PredefinedRoute } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FormData = {
  nombre: string;
  descripcion: string;
  origen: string;
  destino: string;
  activo: boolean;
};

const EMPTY_FORM: FormData = { nombre: '', descripcion: '', origen: '', destino: '', activo: true };

export default function RoutesPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <RoutesPageContent />
    </RoleGuard>
  );
}

function RoutesPageContent() {
  const [routes,  setRoutes]  = useState<PredefinedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<PredefinedRoute | null>(null);
  const [form,    setForm]    = useState<FormData>(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);
      setRoutes(await listPredefinedRoutes());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar rutas.');
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

  function openEdit(r: PredefinedRoute) {
    setEditing(r);
    setForm({
      nombre:      r.nombre,
      descripcion: r.descripcion ?? '',
      origen:      r.origen,
      destino:     r.destino,
      activo:      r.activo,
    });
    setFormErr(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    const payload = {
      nombre:      form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      origen:      form.origen.trim(),
      destino:     form.destino.trim(),
      activo:      form.activo,
    };
    try {
      if (editing) {
        await updatePredefinedRoute(editing.id, payload);
      } else {
        await createPredefinedRoute(payload);
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
      await deletePredefinedRoute(id);
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
          <h1 className="text-base font-semibold">Rutas</h1>
          <p className="text-sm text-muted-foreground">Rutogramas predefinidos de operación</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          Nueva ruta
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
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Origen</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Destino</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</td>
              </tr>
            ) : routes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay rutas registradas.
                </td>
              </tr>
            ) : (
              routes.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.origen}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.destino}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.activo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                      {r.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(r)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`size-7 ${deleting === r.id ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                        onClick={() => void handleDelete(r.id)}
                        title={deleting === r.id ? 'Confirmar eliminación' : 'Eliminar'}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar ruta' : 'Nueva ruta'}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-nombre">Nombre</Label>
                <Input
                  id="r-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ruta Quito → Ibarra"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-origen">Origen</Label>
                  <Input
                    id="r-origen"
                    value={form.origen}
                    onChange={(e) => setForm({ ...form, origen: e.target.value })}
                    placeholder="Quito"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-destino">Destino</Label>
                  <Input
                    id="r-destino"
                    value={form.destino}
                    onChange={(e) => setForm({ ...form, destino: e.target.value })}
                    placeholder="Ibarra"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-desc">Descripción (opcional)</Label>
                <Textarea
                  id="r-desc"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Notas o puntos de control de la ruta…"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  id="r-activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  className="size-4 rounded border-input accent-primary"
                />
                <Label htmlFor="r-activo">Ruta activa</Label>
              </div>

              {formErr ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</p>
              ) : null}
            </div>

            <DialogFooter className="mt-4" showCloseButton>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear ruta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
