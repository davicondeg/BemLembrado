# Bem Lembrado

Painel web do MVP de um assistente de lembretes para pessoas idosas, integrado ao WhatsApp. O responsável cadastra pessoas, contatos e lembretes; o backend registra envios e confirmações e alerta um contato autorizado quando necessário.

## Stack planejada

- Next.js + TypeScript: painel do responsável
- Supabase Auth + PostgreSQL/RLS: autenticação e dados
- n8n: agendamento e orquestração dos fluxos
- WhatsApp Business Cloud: envio e recebimento de mensagens
- OpenAI API: interpretação de linguagem natural somente quando regras determinísticas não bastarem

## Começar localmente

1. Execute `npm install`.
2. Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase.
3. Aplique a migration em `supabase/migrations` no projeto Supabase.
4. Execute `npm run dev` e abra `http://localhost:3000`.

Sem variáveis do Supabase, a página inicial continua disponível com dados demonstrativos.

## Limites do MVP

O sistema apoia a rotina, mas não diagnostica, prescreve, altera doses nem funciona como serviço de emergência. Horários, medicamentos e regras críticas são dados cadastrados e controlados por regras; não ficam sob decisão da IA.

## MVP com WhatsApp

O MVP usa uma conexão **não oficial** via Evolution API/WhatsApp Web. Ela não cobra por mensagem da Meta, mas exige infraestrutura própria continuamente ligada e o número pode ser desconectado ou bloqueado. Não use um número pessoal principal nem faça disparos em massa.

O fluxo implementado é: Evolution → webhook idempotente → Supabase → lembretes/outbox → relay local → Evolution. Consulte [docs/MVP_WHATSAPP.md](docs/MVP_WHATSAPP.md) para configurar e testar.

## Próximas etapas do painel

1. Conectar a autenticação do responsável às telas.
2. Ligar os cadastros visuais às tabelas do Supabase.
3. Exibir lembretes e histórico reais no lugar dos dados demonstrativos.
4. Acrescentar confirmação e alerta ao responsável após a validação do fluxo básico.
