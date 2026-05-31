"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { Button, Field, GhostButton, Input, Notice } from "@/components/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn() {
    if (!supabase) return;
    setSubmitting(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    setSubmitting(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Notice>Configura las variables de Supabase para usar la aplicacion.</Notice>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-sm text-moss">Cargando sesion...</div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-4">
        <form className="w-full max-w-sm rounded-md border border-line bg-white p-5 shadow-subtle" onSubmit={(event) => event.preventDefault()}>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Residencia</p>
          <h2 className="mt-1 text-2xl font-semibold">Acceso a turnos</h2>
          <div className="mt-5 grid gap-3">
            <Field label="Email">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </Field>
            <Field label="Contraseña">
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </Field>
            {message ? <div className="rounded-md border border-saffron/40 bg-[#fff7df] px-3 py-2 text-sm">{message}</div> : null}
            <Button type="button" disabled={submitting || !email || !password} onClick={signIn}>
              Entrar
            </Button>
            <p className="text-sm text-moss">Los usuarios se gestionan desde Supabase por el administrador.</p>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex justify-end border-b border-line bg-white px-4 py-2 lg:hidden">
        <GhostButton type="button" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Salir
        </GhostButton>
      </div>
      <div className="hidden justify-end border-b border-line bg-white px-6 py-2 lg:flex">
        <GhostButton type="button" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Salir
        </GhostButton>
      </div>
      {children}
    </div>
  );
}
