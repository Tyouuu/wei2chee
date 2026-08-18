import Link from "next/link";

// No locale segment, same reason as app/auth/confirm/route.ts: this is the
// target of a link Supabase's own email sends, which has no knowledge of
// next-intl routing. Rare-path error page -- hardcoded bilingual rather than
// wired into the i18n system.
export default function ConfirmErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[15px] text-foreground">确认链接无效或已过期，请重新注册。</p>
      <p className="text-[13px] text-muted-foreground">
        This confirmation link is invalid or has expired. Please sign up again.
      </p>
      <Link href="/zh/login" className="mt-4 text-[13px] text-primary underline-offset-4 hover:underline">
        返回登录 / Back to login
      </Link>
    </main>
  );
}
