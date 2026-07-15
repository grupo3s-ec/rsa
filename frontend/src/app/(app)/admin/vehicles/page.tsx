'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { RoleGuard } from '@/components/auth/RoleGuard';
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
} from '@/lib/api/admin';
import type { Vehicle } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FormData = {
  placa: string;
  marca: string;
  modelo: string;
  anio: string;
  activo: boolean;
};

const EMPTY_FORM: FormData = { placa: '', marca: '', modelo: '', anio: '', activo: true };

export default function VehiclesPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <VehiclesPageContent />
    </RoleGuard>
  );
}

function VehiclesPageContent() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form,    setForm]    = useState<FormData>(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    try {
      setLoading(true);
      setVehicles(await listVehicles());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar vehículos.');
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

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      placa:  v.placa,
      marca:  v.marca,
      modelo: v.modelo,
      anio:   v.anio != null ? String(v.anio) : '',
      activo: v.activo,
    });
    setFormErr(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    const payload = {
      placa:  form.placa.trim().toUpperCase(),
      marca:  form.marca.trim(),
      modelo: form.modelo.trim(),
      anio:   form.anio ? Number(form.anio) : null,
      activo: form.activo,
    };
    try {
      if (editing) {
        await updateVehicle(editing.id, payload);
      } else {
        await createVehicle(payload);
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
      await deleteVehicle(id);
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
          <h1 className="text-base font-semibold">Vehículos</h1>
          <p className="text-sm text-muted-foreground">Flota registrada</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-3.5" />
          Nuevo vehículo
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Placa</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Marca / Modelo</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Año</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando…</td>
              </tr>
            ) : vehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay vehículos registrados.
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium tracking-wide">{v.placa}</td>
                  <td className="px-4 py-3">{v.marca} {v.modelo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.anio ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${v.activo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                      {v.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(v)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`size-7 ${deleting === v.id ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                        onClick={() => void handleDelete(v.id)}
                        title={deleting === v.id ? 'Confirmar eliminación' : 'Eliminar'}
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
              <DialogTitle>{editing ? 'Editar vehículo' : 'Nuevo vehículo'}</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-placa">Placa</Label>
                <Input
                  id="v-placa"
                  value={form.placa}
                  onChange={(e) => setForm({ ...form, placa: e.target.value })}
                  placeholder="ABC-1234"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="v-marca">Marca</Label>
                  <Input
                    id="v-marca"
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    placeholder="Chevrolet"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-modelo">Modelo</Label>
                  <Input
                    id="v-modelo"
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                    placeholder="NHR"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="v-anio">Año</Label>
                  <Input
                    id="v-anio"
                    type="number"
                    min={1990}
                    max={2100}
                    value={form.anio}
                    onChange={(e) => setForm({ ...form, anio: e.target.value })}
                    placeholder="2022"
                  />
                </div>
                <div className="flex items-end pb-0.5 space-x-2">
                  <input
                    id="v-activo"
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    className="size-4 rounded border-input accent-primary"
                  />
                  <Label htmlFor="v-activo">Activo</Label>
                </div>
              </div>

              {formErr ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{formErr}</p>
              ) : null}
            </div>

            <DialogFooter className="mt-4" showCloseButton>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear vehículo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
