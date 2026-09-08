"use client";

/**
 * One text field on the auth pages, and the submit button beside it.
 *
 * WHY THESE EXIST AS A SHARED PIECE. Login and signup each declared their own
 * inputs with their own class strings, and both produced the same result: a
 * bare bordered box, no placeholder, no autocomplete hint, and a focus state
 * that only existed in the class list because nothing about the box changed
 * enough to see. On the page where someone decides whether to trust this
 * product with their business, "the inputs look unfinished" is not a cosmetic
 * note — it is the whole impression.
 *
 * The focus treatment is a real ring plus a border change, because on this dark
 * ground a border shift alone is close to invisible; and `autoComplete` is set
 * properly so a password manager fills the form, which is the single most
 * professional-feeling detail on any sign-in page.
 */

export const authSubmitClass =
  "h-11 w-full rounded-lg bg-primary [font-size:var(--text-sm)] font-semibold text-primary-foreground transition-colors " +
  "enabled:hover:bg-primary/90 disabled:opacity-55 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  hint,
  minLength,
}: {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="[font-size:var(--text-sm)] font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        /* 🔴 边用 --input，不是 --border（2026-09-08）。
           --border 是**卡片那条边**，它不传达「这里可以操作」，所以它本来就淡；
           而登入这两个框量出来 **1.35:1**，标准要 3:1（WCAG 1.4.11）。
           这一个档案同时服务登入 · 忘记密码 · 重设密码 —— 改一个地方，三页一起。 */
        className="h-11 w-full rounded-lg border border-input bg-background/70 px-3.5 [font-size:var(--text-sm)] text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/45"
      />
      {hint && <p className="[font-size:var(--text-xs)] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
