import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { SimulationLab } from "./simulation-lab";

export default async function Simulator() {
  const { user, supabase } = await requireUser();
  const { data: reminder } = await supabase.from("reminders").select("title").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return <AppShell email={user.email || "Responsável"} active="/simulador">
    <header className="sectionHeader simulationTitle"><div><p className="eyebrow">LABORATÓRIO DE CONVERSAS</p><h1>Simulação do atendimento</h1><p>Converse pelos dois lados e acompanhe como o bot conecta a pessoa assistida ao responsável.</p></div></header>
    <SimulationLab reminderTitle={reminder?.title || "Remédio da manhã"}/>
  </AppShell>;
}
