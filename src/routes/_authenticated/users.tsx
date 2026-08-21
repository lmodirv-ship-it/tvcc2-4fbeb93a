import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, ShieldCheck, Lock, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRoles, PERMANENT_OWNER_EMAIL } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/users")({
  component: Page,
  head: () => ({
    meta: [
      { title: "المستخدمون والفريق — TVCC" },
      { name: "description", content: "إدارة فريق المنصة وصلاحياتهم والمستخدمين الموحدين للمواقع." },
    ],
  }),
});

const ROLE_LABEL: Record<string, string> = {
  system_owner: "مالك المنصة",
  admin: "مدير (Admin)",
  editor: "محرر (Editor)",
  viewer: "مشاهد (Viewer)",
};

function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">المستخدمون والفريق</h1>
        <p className="text-muted-foreground mt-1">امنح فريقك دور Admin أو Editor ليروا كل ما تراه في المنصة</p>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">فريق المنصة</TabsTrigger>
          <TabsTrigger value="site-users">المستخدمون الموحدون</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="mt-4">
          <TeamTab />
        </TabsContent>
        <TabsContent value="site-users" className="mt-4">
          <SiteUsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Team ---------------- */

function TeamTab() {
  const qc = useQueryClient();
  const { isSystemOwner } = useRoles();
  const [open, setOpen] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, created_at"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.id),
      }));
    },
  });

  const { data: invites } = useQuery({
    queryKey: ["team-invites"],
    queryFn: async () =>
      (await supabase.from("team_invitations").select("*").order("created_at", { ascending: false })).data || [],
  });

  const setRole = async (userId: string, email: string, role: string) => {
    if (email.toLowerCase() === PERMANENT_OWNER_EMAIL) return toast.error("حساب مالك المنصة محمي");
    const { error: delErr } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .in("role", ["admin", "editor", "viewer"]);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as never });
    if (error) return toast.error(error.message);
    toast.success(`تم تعيين الدور: ${ROLE_LABEL[role]}`);
    qc.invalidateQueries({ queryKey: ["team-members"] });
  };

  const removeInvite = async (id: string) => {
    const { error } = await supabase.from("team_invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف الدعوة");
    qc.invalidateQueries({ queryKey: ["team-invites"] });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-success" />
          <div className="flex-1 min-w-[240px]">
            <div className="font-semibold text-sm">مالك المنصة الدائم</div>
            <div className="text-xs text-muted-foreground" dir="ltr">{PERMANENT_OWNER_EMAIL}</div>
          </div>
          <Badge className="gap-1"><Lock className="w-3 h-3" /> محمي — لا يُحذف ولا تتغير صلاحيته</Badge>
          {isSystemOwner && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="w-4 h-4 ml-1" /> دعوة عضو</Button>
              </DialogTrigger>
              <InviteDialog
                onDone={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["team-invites"] });
                }}
              />
            </Dialog>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="font-semibold mb-3">أعضاء لديهم حساب</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>تغيير الدور</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow>
              ) : !members?.length ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">لا يوجد أعضاء</TableCell></TableRow>
              ) : (
                members.map((m) => {
                  const locked = (m.email || "").toLowerCase() === PERMANENT_OWNER_EMAIL;
                  const current = m.roles.find((r) => r.role !== "system_owner")?.role || "viewer";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                      <TableCell dir="ltr">{m.email}</TableCell>
                      <TableCell className="space-x-1 space-x-reverse">
                        {m.roles.length ? m.roles.map((r) => (
                          <Badge key={r.id} variant={r.role === "system_owner" ? "default" : "secondary"}>
                            {ROLE_LABEL[r.role] || r.role}
                          </Badge>
                        )) : <Badge variant="secondary">بدون</Badge>}
                      </TableCell>
                      <TableCell>
                        {locked ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> محمي</span>
                        ) : isSystemOwner ? (
                          <Select value={current} onValueChange={(v) => setRole(m.id, m.email || "", v)}>
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">مدير (Admin)</SelectItem>
                              <SelectItem value="editor">محرر (Editor)</SelectItem>
                              <SelectItem value="viewer">مشاهد (Viewer)</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">للمالك فقط</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="font-semibold mb-3">دعوات بانتظار التسجيل</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البريد</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>رابط التسجيل</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!invites?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد دعوات</TableCell></TableRow>
              ) : (
                invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell dir="ltr">{i.email}</TableCell>
                    <TableCell><Badge variant="secondary">{ROLE_LABEL[i.role] || i.role}</Badge></TableCell>
                    <TableCell>
                      {i.accepted_at ? <Badge>مُفعّلة</Badge> : <Badge variant="secondary">بانتظار التسجيل</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const url = `${window.location.origin}/auth`;
                          navigator.clipboard.writeText(url);
                          toast.success("تم نسخ رابط التسجيل");
                        }}
                      >
                        <Copy className="w-3 h-3 ml-1" /> نسخ
                      </Button>
                    </TableCell>
                    <TableCell>
                      {isSystemOwner && (
                        <Button size="sm" variant="ghost" onClick={() => removeInvite(i.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            بعد الدعوة، يسجّل الشخص بنفس البريد من صفحة الدخول فيحصل تلقائياً على الدور المحدد ويرى كل بيانات المنصة.
            أعضاء الفريق يمكنهم العرض والإضافة والتعديل — لكن حذف المواقع محصور بك وحدك.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function InviteDialog({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [full_name, setName] = useState("");
  const [role, setRole] = useState("admin");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("team_invitations")
      .upsert(
        { email: email.trim().toLowerCase(), full_name, role: role as never, invited_by: user?.id ?? null, accepted_at: null },
        { onConflict: "email" },
      );
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تمت الدعوة — اطلب منه التسجيل بنفس البريد");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>دعوة عضو للفريق</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>الاسم</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>البريد</Label><Input dir="ltr" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>الدور</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">مدير (Admin) — يرى كل شيء</SelectItem>
              <SelectItem value="editor">محرر (Editor) — عرض وتعديل</SelectItem>
              <SelectItem value="viewer">مشاهد (Viewer)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}إرسال الدعوة</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ---------------- Site users ---------------- */

function SiteUsersTab() {
  const qc = useQueryClient();
  const { isSystemOwner } = useRoles();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["site_users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_users").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">حساب واحد يصل لعدة مواقع</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> مستخدم جديد</Button></DialogTrigger>
          <AddDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["site_users"] }); }} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>المعرف</TableHead><TableHead>الاسم</TableHead><TableHead>البريد</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></TableCell></TableRow> :
                !data?.length ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا يوجد</TableCell></TableRow> :
                data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{u.external_id}</code></TableCell>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "نشط" : "موقوف"}</Badge></TableCell>
                    <TableCell>
                      {isSystemOwner && (
                        <Button size="sm" variant="ghost" onClick={async () => { if (confirm("حذف؟")) { const { error } = await supabase.from("site_users").delete().eq("id", u.id); if (error) toast.error(error.message); qc.invalidateQueries({ queryKey: ["site_users"] }); } }}><Trash2 className="w-3 h-3" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AddDialog({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [full_name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("site_users").insert({ owner_id: user.id, email, full_name });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>مستخدم موحد جديد</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>الاسم</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label>البريد</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <DialogFooter><Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
