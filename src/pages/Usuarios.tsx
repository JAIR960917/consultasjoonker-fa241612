import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, UserPlus, Pencil, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Row {
  user_id: string;
  full_name: string;
  email: string;
  cidade: string;
  empresa_id: string | null;
  empresa_nome: string;
  role: string;
}

interface EmpresaOption {
  id: string;
  nome: string;
  cidade: string;
}

export default function Usuarios() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", cidade: "", role: "gerente", empresa_id: "",
  });

  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ cidade: "", empresa_id: "", role: "gerente", password: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleting, setDeleting] = useState<Row | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: emps }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, cidade, empresa_id"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("empresas").select("id, nome, cidade").eq("ativo", true).order("nome"),
    ]);
    const empMap = new Map((emps ?? []).map((e) => [e.id, e.nome]));
    const merged: Row[] = (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: p.email,
      cidade: (p as { cidade?: string }).cidade ?? "",
      empresa_id: (p as { empresa_id?: string | null }).empresa_id ?? null,
      empresa_nome: empMap.get((p as { empresa_id?: string }).empresa_id ?? "") ?? "—",
      role: roles?.find((r) => r.user_id === p.user_id)?.role ?? "—",
    }));
    setRows(merged);
    setEmpresas((emps ?? []) as EmpresaOption[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role === "gerente" && !form.empresa_id) {
      toast.error("Selecione a empresa do gerente");
      return;
    }
    setCreating(true);
    const payload = { ...form, empresa_id: form.empresa_id || null };
    const { data, error } = await supabase.functions.invoke("admin-create-user", { body: payload });
    setCreating(false);
    if (error || (data as { error?: string })?.error) {
      toast.error("Erro ao criar usuário", { description: error?.message ?? (data as { error?: string }).error });
      return;
    }
    toast.success("Usuário criado");
    setForm({ full_name: "", email: "", password: "", cidade: "", role: "gerente", empresa_id: "" });
    load();
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setEditForm({
      cidade: r.cidade ?? "",
      empresa_id: r.empresa_id ?? "",
      role: r.role === "admin" ? "admin" : "gerente",
      password: "",
    });
  };

  const onEditEmpresaChange = (id: string) => {
    const emp = empresas.find((e) => e.id === id);
    setEditForm((f) => ({ ...f, empresa_id: id, cidade: emp?.cidade || f.cidade }));
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editForm.role === "gerente" && !editForm.empresa_id) {
      toast.error("Selecione a empresa do gerente");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    setSavingEdit(true);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: {
        user_id: editing.user_id,
        cidade: editForm.cidade,
        empresa_id: editForm.empresa_id || null,
        role: editForm.role,
        password: editForm.password || undefined,
      },
    });
    setSavingEdit(false);
    if (error || (data as { error?: string })?.error) {
      toast.error("Erro ao atualizar", { description: error?.message ?? (data as { error?: string }).error });
      return;
    }
    toast.success("Usuário atualizado");
    setEditing(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: deleting.user_id },
    });
    setRemoving(false);
    if (error || (data as { error?: string })?.error) {
      toast.error("Erro ao excluir", { description: error?.message ?? (data as { error?: string }).error });
      return;
    }
    toast.success("Usuário excluído");
    setDeleting(null);
    load();
  };

  const roleLabel = (r: string) =>
    r === "admin" ? "Administrador" : r === "gerente" ? "Gerente" : r;

  const onEmpresaChange = (id: string) => {
    const emp = empresas.find((e) => e.id === id);
    setForm((f) => ({ ...f, empresa_id: id, cidade: emp?.cidade || f.cidade }));
  };

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground">Gerencie gerentes e administradores</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card className="shadow-card">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Empresa</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : rows.map((r) => {
                  const isSelf = r.user_id === user?.id;
                  return (
                    <tr key={r.user_id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{r.full_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.empresa_nome}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.cidade || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.role === "admin" ? "bg-accent/15 text-accent-foreground" : "bg-muted text-muted-foreground"
                        }`}>{roleLabel(r.role)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)} disabled={isSelf} title={isSelf ? "Não é possível editar a si mesmo" : "Editar"}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleting(r)} disabled={isSelf} title={isSelf ? "Não é possível excluir a si mesmo" : "Excluir"}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="shadow-elegant h-fit">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Novo usuário</h2>
            </div>
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Senha (mín. 6)</Label>
                <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Empresa {form.role === "gerente" && <span className="text-destructive">*</span>}</Label>
                <Select value={form.empresa_id} onValueChange={onEmpresaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={empresas.length === 0 ? "Cadastre uma empresa primeiro" : "Selecione…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}{e.cidade ? ` — ${e.cidade}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex.: São Paulo" />
              </div>
              <Button type="submit" disabled={creating} className="w-full bg-gradient-primary">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar usuário"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{editing.full_name} • {editing.email}</p>
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Empresa {editForm.role === "gerente" && <span className="text-destructive">*</span>}</Label>
                <Select value={editForm.empresa_id} onValueChange={onEditEmpresaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={empresas.length === 0 ? "Nenhuma empresa" : "Selecione…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}{e.cidade ? ` — ${e.cidade}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={editForm.cidade} onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })} />
              <div className="space-y-1.5">
                <Label>Nova senha <span className="text-xs text-muted-foreground">(deixe em branco para manter)</span></Label>
                <Input type="password" minLength={6} placeholder="Mín. 6 caracteres" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
              </div>
            </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="bg-gradient-primary">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.full_name || deleting?.email}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={removing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
