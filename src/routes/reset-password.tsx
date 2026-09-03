import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — TVCC" },
      { name: "description", content: "صفحة استعادة الحساب وتعيين كلمة مرور جديدة لمنصة TVCC." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — TVCC" },
      { property: "og:description", content: "استعد حسابك على منصة TVCC بتعيين كلمة مرور جديدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("كلمة السر يجب أن تكون 8 أحرف على الأقل");
    if (password !== confirm) return toast.error("كلمتا السر غير متطابقتين");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("تم تحديث كلمة السر");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md" style={{ boxShadow: "var(--shadow-card)" }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> كلمة مرور جديدة
          </CardTitle>
          <CardDescription>
            {ready
              ? "اختر كلمة مرور جديدة لحسابك"
              : "افتح هذه الصفحة من رابط الاستعادة المرسل إلى بريدك"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np">كلمة المرور الجديدة</Label>
              <Input id="np" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp">تأكيد كلمة المرور</Label>
              <Input id="cp" dir="ltr" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              حفظ كلمة المرور
            </Button>
            <Link to="/auth" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              العودة لتسجيل الدخول
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
