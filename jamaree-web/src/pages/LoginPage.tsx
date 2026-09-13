import { useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Flame } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { supabase } from "@/lib/supabase";

/** ประตูหน้าร้าน — ฐานข้อมูลเปิดให้เฉพาะคนที่ล็อกอินแล้ว */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : error.message,
      );
      setBusy(false);
    }
    // ถ้าเข้าได้ ระบบจะพาเข้าหน้าหลักให้เองทันที
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center gap-2.5 text-center">
          <span className="flex size-12 items-center justify-center rounded-card bg-accent text-on-accent">
            <Flame size={24} />
          </span>
          <div>
            <h1 className="font-head text-xl font-semibold text-ink">
              JAMAREE GAS
            </h1>
            <p className="text-sm text-muted">เข้าสู่ระบบเพื่อใช้งาน</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-3.5 rounded-card border border-line bg-card p-5 shadow-card"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-btn border border-danger/30 bg-danger-soft p-3 text-sm text-ink">
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0 text-danger"
              />
              <span>{error}</span>
            </div>
          )}

          <Field label="อีเมล">
            {(id) => (
              <TextInput
                id={id}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            )}
          </Field>

          <Field label="รหัสผ่าน">
            {(id) => (
              <TextInput
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          ยังไม่มีบัญชี? สร้างผู้ใช้ได้ที่ Supabase → Authentication → Users
        </p>
      </div>
    </div>
  );
}
