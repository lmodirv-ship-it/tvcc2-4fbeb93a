import { useMemo, useState } from "react";
import { Search, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const GROUPS = [
  { name: "الملفات والمجلدات", rows: [["ls -la", "عرض الملفات بالتفصيل"], ["cd /var/www", "تغيير المجلد"], ["pwd", "عرض المسار الحالي"], ["mkdir project", "إنشاء مجلد"], ["cp source target", "نسخ ملف أو مجلد"], ["mv old new", "نقل أو إعادة تسمية"], ["rm -rf path", "حذف ملف أو مجلد — خطر"], ["find / -name '*.log'", "البحث عن ملفات"], ["chmod +x script.sh", "تغيير الصلاحيات"], ["chown user:group file", "تغيير المالك"]] },
  { name: "معلومات النظام والمراقبة", rows: [["top", "عرض العمليات الحية"], ["htop", "مراقبة تفاعلية للموارد"], ["df -h", "مساحة الأقراص"], ["free -h", "استهلاك الذاكرة"], ["uname -a", "معلومات النظام والنواة"], ["uptime", "مدة التشغيل ومتوسط الحمل"], ["whoami", "المستخدم الحالي"], ["date", "التاريخ والوقت"]] },
  { name: "المستخدمون والصلاحيات", rows: [["adduser NAME", "إضافة مستخدم"], ["deluser NAME", "حذف مستخدم"], ["passwd NAME", "تغيير كلمة المرور"], ["usermod -aG sudo NAME", "إضافة مستخدم لمجموعة sudo"], ["groups NAME", "عرض مجموعات المستخدم"], ["su - NAME", "التبديل إلى مستخدم"]] },
  { name: "الحزم والتحديثات", rows: [["apt update", "تحديث قائمة الحزم"], ["apt upgrade -y", "ترقية الحزم"], ["apt install PACKAGE", "تثبيت حزمة"], ["apt remove PACKAGE", "إزالة حزمة"], ["apt autoremove", "إزالة الحزم غير اللازمة"], ["apt search NAME", "البحث عن حزمة"], ["dpkg -l", "عرض الحزم المثبتة"]] },
  { name: "الشبكة", rows: [["ip a", "واجهات الشبكة وعناوين IP"], ["ping HOST", "اختبار الاتصال"], ["ss -tulpn", "المنافذ والاتصالات"], ["curl -I URL", "فحص استجابة HTTP"], ["wget URL", "تنزيل ملف"], ["ufw status", "حالة الجدار الناري"], ["ufw allow 80/tcp", "فتح منفذ"]] },
  { name: "العمليات", rows: [["ps aux", "عرض العمليات"], ["kill PID", "إنهاء عملية"], ["killall NAME", "إنهاء العمليات بالاسم"], ["pkill -f PATTERN", "إنهاء العمليات حسب نمط"], ["jobs", "عرض مهام الخلفية"], ["bg", "متابعة مهمة في الخلفية"], ["fg", "إعادة مهمة للواجهة"]] },
  { name: "خدمات Systemd", rows: [["systemctl status SERVICE", "عرض حالة خدمة"], ["systemctl start SERVICE", "تشغيل خدمة"], ["systemctl stop SERVICE", "إيقاف خدمة"], ["systemctl restart SERVICE", "إعادة تشغيل خدمة"], ["systemctl enable SERVICE", "تشغيل تلقائي عند الإقلاع"], ["systemctl disable SERVICE", "تعطيل التشغيل التلقائي"], ["journalctl -u SERVICE -n 200", "عرض سجل خدمة"]] },
  { name: "الأقراص والتخزين", rows: [["lsblk", "عرض الأقراص والأقسام"], ["fdisk -l", "تفاصيل الأقراص"], ["mount DEVICE PATH", "تحميل قسم"], ["umount PATH", "إلغاء تحميل قسم"], ["du -sh PATH", "حجم مجلد"]] },
  { name: "معالجة النصوص", rows: [["grep 'text' file", "البحث داخل ملف"], ["head -n 10 file", "أول أسطر الملف"], ["tail -f file", "متابعة آخر السجل"], ["wc -l file", "عد الأسطر"], ["awk '{print $1}' file", "استخراج أعمدة"], ["sed -i 's/old/new/g' file", "استبدال نص"]] },
] as const;

export function CommandGuide({ onChoose }: { onChoose: (command: string) => void }) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => GROUPS.map((group) => ({ ...group, rows: group.rows.filter(([command, role]) => `${command} ${role}`.toLowerCase().includes(search.toLowerCase())) })).filter((group) => group.rows.length), [search]);
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline"><TerminalSquare className="size-4" /> الأوامر</Button></DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden" dir="rtl">
        <DialogHeader><DialogTitle>دليل أوامر Ubuntu</DialogTitle></DialogHeader>
        <div className="relative"><Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" /><Input className="pr-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن أمر أو وظيفة…" /></div>
        <div className="overflow-y-auto max-h-[66vh] space-y-5 pl-1">
          {groups.map((group) => <section key={group.name} className="space-y-2">
            <h3 className="sticky top-0 bg-background py-2 font-semibold"><Badge variant="secondary">{group.name}</Badge></h3>
            <div className="rounded-md border divide-y">
              {group.rows.map(([command, role]) => <button key={command} type="button" className="w-full grid gap-1 p-3 text-right hover:bg-muted/60 md:grid-cols-[minmax(16rem,1fr)_2fr]" onClick={() => onChoose(command)}>
                <code className="text-primary text-left" dir="ltr">{command}</code><span className="text-sm text-muted-foreground">{role}</span>
              </button>)}
            </div>
          </section>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
