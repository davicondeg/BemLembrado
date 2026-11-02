"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LinkCode = { code: string; expiresAt: string };

export default function LinkCodePanel() {
  const [data, setData] = useState<LinkCode | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/whatsapp/link-code", { method: "POST", headers: { authorization: `Bearer ${session.access_token}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error === "configuration_incomplete" ? "O servidor ainda não possui os segredos necessários para gerar códigos." : body.error || "Falha ao gerar código.");
      setData(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha inesperada."); }
    finally { setLoading(false); }
  }

  return <section className="card linkCard">
    <div className="stepNumber">1</div><div><p className="eyebrow">CÓDIGO TEMPORÁRIO</p><h2>Gere seu código de vínculo</h2><p>Depois, envie o código pelo WhatsApp para o número do bot. Ele expira em dez minutos e só pode vincular uma conta.</p>
      {error && <p className="formMessage error">{error}</p>}
      {data ? <div className="linkCode"><strong>{data.code}</strong><span>Válido até {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(data.expiresAt))}</span></div> : <button className="primary" onClick={generate} disabled={loading}>{loading ? "Gerando..." : "Gerar código"}</button>}
    </div>
  </section>;
}
