# MVP WhatsApp com Evolution API

Esta integração é não oficial e usa uma sessão do WhatsApp Web. Ela serve para validar o produto, não garante disponibilidade e pode causar desconexão ou bloqueio do número. Use um chip secundário, tenha consentimento dos participantes e evite spam ou automação em massa.

## 1. Preparar o Supabase

1. Crie um projeto no Supabase.
2. Aplique, em ordem, os arquivos de `supabase/migrations` pelo SQL Editor ou CLI.
3. Em Authentication, crie o primeiro usuário responsável.
4. Copie a URL, publishable key e service role para `.env.local`. A service role existe apenas no backend e nunca deve receber o prefixo `NEXT_PUBLIC_`.
5. Gere três segredos longos e diferentes para `EVOLUTION_WEBHOOK_SECRET`, `RELAY_SECRET` e `JOBS_SECRET`.

Para o primeiro teste, vincule o telefone pelo endpoint `POST /api/whatsapp/link-code` depois que o painel tiver uma sessão autenticada. O retorno contém um código `APP-123456`, válido por dez minutos, que deve ser enviado ao número do bot.

## 2. Subir a Evolution localmente

No PowerShell, a partir da raiz:

```powershell
Copy-Item .\infra\evolution\.env.example .\infra\evolution\.env
```

Preencha chaves e senhas fortes no arquivo criado. Use os mesmos valores de `EVOLUTION_API_KEY` em `.env.local` e `infra/evolution/.env`.

```powershell
docker compose --env-file .\infra\evolution\.env -f .\infra\evolution\docker-compose.yml up -d
docker compose --env-file .\infra\evolution\.env -f .\infra\evolution\docker-compose.yml ps
```

A API fica restrita a `127.0.0.1:8080`; PostgreSQL e Redis não publicam portas no host. Os três volumes preservam banco, cache e sessão.

## 3. Expor somente o webhook

A Evolution local precisa alcançar o backend por HTTPS. Durante o MVP, publique o Next.js na Vercel ou use um túnel HTTPS apontando para `http://localhost:3000`. Nunca crie um túnel para a porta 8080.

Defina a URL pública do webhook, incluindo o segredo:

```text
https://SEU-ENDERECO/api/webhooks/evolution?secret=SEU_EVOLUTION_WEBHOOK_SECRET
```

O segredo na URL pode aparecer em logs do provedor do túnel. Para um piloto controlado isso simplifica a configuração; na VPS, prefira um proxy que injete `x-webhook-secret` e não registre o valor.

## 4. Criar a instância e conectar o chip

Com a Evolution saudável, execute no PowerShell, substituindo a chave e a URL pública:

```powershell
$headers = @{ apikey = "SUA_EVOLUTION_API_KEY"; "Content-Type" = "application/json" }
$body = @{
  instanceName = "bem-lembrado"
  qrcode = $true
  integration = "WHATSAPP-BAILEYS"
  webhook = @{
    enabled = $true
    url = "https://SEU-ENDERECO/api/webhooks/evolution?secret=SEU_SEGREDO"
    webhookByEvents = $false
    events = @("MESSAGES_UPSERT")
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8080/instance/create" -Headers $headers -Body $body
```

Se a resposta não trouxer um QR Code utilizável, solicite outro:

```powershell
$qr = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8080/instance/connect/bem-lembrado" -Headers $headers
$qr
```

O retorno normalmente contém o QR em Base64. Remova o prefixo `data:image/png;base64,`, converta para arquivo e abra-o:

```powershell
$base64 = ($qr.base64 -replace '^data:image/[^;]+;base64,','')
[IO.File]::WriteAllBytes((Join-Path $PWD "qr-temporario.png"), [Convert]::FromBase64String($base64))
Start-Process (Join-Path $PWD "qr-temporario.png")
```

No celular do chip: WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho → escaneie o QR. Apague `qr-temporario.png` após conectar; ele não deve ser versionado nem compartilhado.

Confira o estado:

```powershell
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8080/instance/connectionState/bem-lembrado" -Headers $headers
```

O estado esperado é `open`. Se você criou a instância sem webhook, configure-o pela interface/API da Evolution antes do teste e habilite somente `MESSAGES_UPSERT`.

## 5. Rodar aplicação e relay

Em dois terminais:

```powershell
npm run dev
```

```powershell
$env:APP_BASE_URL="http://localhost:3000"
$env:EVOLUTION_BASE_URL="http://127.0.0.1:8080"
$env:EVOLUTION_API_KEY="SUA_CHAVE"
$env:RELAY_SECRET="SEU_RELAY_SECRET"
$env:JOBS_SECRET="SEU_JOBS_SECRET"
$env:EVOLUTION_INSTANCE="bem-lembrado"
npm run worker
```

O relay consulta os vencimentos em cada ciclo, reserva uma mensagem da outbox e envia pela Evolution. Falhas usam backoff exponencial e itens travados por uma queda do processo podem ser retomados depois de cinco minutos.

## 6. Testar o fluxo

1. Gere e envie o código de vínculo pelo WhatsApp do participante.
2. Aguarde a confirmação de vínculo.
3. Envie: `Me lembre de tomar creatina hoje às 20h.`
4. Verifique a confirmação com horário local.
5. Para um teste rápido, use um horário dois ou três minutos à frente.
6. Confira `reminders`, `inbound_messages`, `bot_outbox` e `reminder_events` no Supabase.
7. Envie `Quais são meus lembretes?` e depois `Cancele o lembrete de tomar creatina`.

O horário é convertido de `America/Sao_Paulo` para UTC em `scheduled_at`. Reiniciar o relay não perde lembretes; os vencidos são despachados no próximo ciclo.

## Limites atuais

- O parser determinístico cobre hoje, amanhã, horário e recorrência diária. Frases mais livres ainda exigirão a camada de IA.
- A recorrência diária avança 24 horas; isso atende o fuso atual de São Paulo, mas deve ser substituído por cálculo baseado em calendário antes de suportar fusos com horário de verão.
- O painel ainda mostra dados demonstrativos.
- O fluxo completo real exige Supabase configurado, URL HTTPS pública e chip conectado; os testes automatizados locais não simulam a rede do WhatsApp.
