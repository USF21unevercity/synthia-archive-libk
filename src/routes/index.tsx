import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة الأرشفة العلمية | إدارة قنوات تليجرام التعليمية" },
      {
        name: "description",
        content:
          "منصة متكاملة لأرشفة وتصنيف والبحث في المحتوى العلمي المنشور في قنوات تليجرام، مبنية على PostgreSQL خارجية وبنية معمارية نظيفة.",
      },
      { property: "og:title", content: "منصة الأرشفة العلمية لقنوات تليجرام" },
      {
        property: "og:description",
        content:
          "أرشفة تلقائية، تصنيف علمي، وسوم ذكية، محرك بحث عالي الأداء، وإحصائيات شاملة لآلاف القنوات وملايين الملفات.",
      },
    ],
  }),
  component: Index,
});

const MODULES: Array<{ id: number; name: string; state: "done" | "next" }> = [
  { id: 1, name: "نواة تليجرام", state: "done" },
  { id: 2, name: "إدارة القنوات", state: "done" },
  { id: 3, name: "إدارة المشرفين", state: "done" },
  { id: 4, name: "نظام الصلاحيات RBAC", state: "done" },
  { id: 5, name: "إدارة الملفات العلمية", state: "done" },
  { id: 6, name: "نظام الأرشفة", state: "done" },
  { id: 7, name: "محرك البحث", state: "done" },
  { id: 8, name: "الفهرسة العلمية", state: "done" },
  { id: 9, name: "إدارة الوسوم", state: "done" },
  { id: 10, name: "الإحصائيات", state: "done" },
  { id: 11, name: "التقارير PDF / Excel", state: "next" },
  { id: 12, name: "الإعدادات", state: "done" },
  { id: 13, name: "سجلات النشاط", state: "done" },
];

const LAYERS = [
  {
    title: "طبقة النطاق",
    path: "domain/",
    body: "الكيانات وأنواع البيانات العلمية بدون أي اعتماد على تليجرام أو قاعدة البيانات.",
  },
  {
    title: "طبقة البنية التحتية",
    path: "infrastructure/",
    body: "اتصال PostgreSQL الخارجية، نظام الترحيلات، ومستودعات البيانات بنمط Repository.",
  },
  {
    title: "طبقة الخدمات",
    path: "services/",
    body: "منطق العمل بالكامل: الصلاحيات، استخراج المحتوى، الأرشفة، البحث، الإحصائيات.",
  },
  {
    title: "طبقة تليجرام",
    path: "telegram/",
    body: "عميل Bot API وموزّع التحديثات والأوامر — بلا أي منطق عمل داخلها.",
  },
];

const FILE_TYPES = [
  "PDF",
  "DOC",
  "DOCX",
  "PPT",
  "PPTX",
  "XLS",
  "XLSX",
  "ZIP",
  "RAR",
  "صور",
  "فيديو",
  "صوت",
  "روابط",
  "نصوص",
];

const ENV_VARS = ["BOT_TOKEN", "DATABASE_URL", "OWNER_ID", "ARCHIVE_CHANNEL_ID", "LOG_LEVEL"];

const COMMANDS: Array<[string, string]> = [
  ["/addchannel", "تسجيل قناة جديدة في المنصة"],
  ["/channels", "عرض القنوات وحالتها"],
  ["/setarchive", "تحديد قناة الأرشيف لقناة معينة"],
  ["/addadmin", "إضافة مشرف بدور محدد"],
  ["/assign", "إسناد قناة إلى مشرف"],
  ["/search", "بحث متقدم: type / tag / channel / from / to"],
  ["/stats", "إحصائيات القنوات والملفات والأرشيف"],
  ["/tags", "الوسوم الأكثر استخداماً"],
  ["/logs", "آخر أنشطة المشرفين"],
];

function Index() {
  return (
    <main className="min-h-screen">
      <section className="gradient-hero border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            المرحلة الأولى — الأساس المعماري جاهز
          </span>

          <h1 className="mt-7 max-w-3xl text-4xl leading-[1.25] font-black sm:text-6xl sm:leading-[1.2]">
            منصة <span className="text-gradient-accent">الأرشفة العلمية</span> لقنوات تليجرام
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            نظام مؤسسي لأرشفة وتصنيف وفهرسة والبحث في المحتوى العلمي المنشور داخل قنوات تليجرام.
            بنية نظيفة، وحدات مستقلة، وقاعدة بيانات PostgreSQL خارجية جاهزة لآلاف القنوات وملايين
            الملفات.
          </p>

          <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["١٣", "وحدة نظام"],
              ["١٤", "نوع محتوى"],
              ["PostgreSQL", "قاعدة بيانات خارجية"],
              ["RBAC", "نظام صلاحيات"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-card/70 p-5 shadow-elevated backdrop-blur"
              >
                <dt className="text-2xl font-bold text-primary">{value}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-bold sm:text-3xl">وحدات النظام</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          كل وحدة مستقلة قابلة للتطوير دون المساس ببقية النظام.
        </p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => (
            <li
              key={module.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">
                  {module.id}
                </span>
                <span className="text-sm font-semibold">{module.name}</span>
              </span>
              <span
                className={
                  module.state === "done"
                    ? "rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-bold text-success"
                    : "rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-bold text-warning"
                }
              >
                {module.state === "done" ? "منجزة" : "قادمة"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-bold sm:text-3xl">البنية المعمارية</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {LAYERS.map((layer) => (
              <article key={layer.path} className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-bold">{layer.title}</h3>
                <code className="mt-1 block text-xs text-primary" dir="ltr">
                  bot/src/{layer.path}
                </code>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{layer.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">أنواع المحتوى المدعومة</h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {FILE_TYPES.map((type) => (
                <li
                  key={type}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium"
                >
                  {type}
                </li>
              ))}
            </ul>

            <h3 className="mt-10 text-lg font-bold">متغيرات البيئة</h3>
            <ul className="mt-4 space-y-2" dir="ltr">
              {ENV_VARS.map((name) => (
                <li
                  key={name}
                  className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-primary"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">أوامر البوت</h2>
            <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {COMMANDS.map(([command, description]) => (
                <li key={command} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <code className="shrink-0 font-mono text-sm text-primary" dir="ltr">
                    {command}
                  </code>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">
          الكود المصدري للبوت في مجلد <code className="text-primary" dir="ltr">bot/</code> — جاهز
          للنشر على Docker و Render و Oracle Cloud دون أي تعديل في الكود.
        </div>
      </footer>
    </main>
  );
}
