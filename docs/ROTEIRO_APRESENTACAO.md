# Roteiro de apresentação — Bem Lembrado

Este documento é uma base viva para a apresentação do projeto. Ele deve ser atualizado conforme novos fluxos forem implementados e aprovados.

## Objetivo da apresentação

Demonstrar como o Bem Lembrado funciona como um serviço por assinatura para apoiar a rotina da pessoa idosa, conectando responsáveis, lembretes e acompanhamento por meio de uma experiência simples e integrada ao WhatsApp.

## Preparação antes de apresentar

- Confirmar que o projeto está rodando em `http://localhost:3000`.
- Abrir o navegador em uma janela limpa ou anônima.
- Confirmar que os dados de demonstração estão disponíveis.
- Verificar se não existe uma sessão anterior conectada.
- Deixar as credenciais demonstrativas acessíveis para consulta.

## 1. Apresentação inicial do produto

### Fala sugerida

> O Bem Lembrado é um assistente de apoio à rotina da pessoa idosa. O responsável organiza lembretes e acompanha confirmações pelo painel, enquanto a pessoa assistida interage por um canal que já conhece: o WhatsApp.

### Objetivo

Explicar o problema e a proposta antes de começar a navegar pelo sistema.

## 2. Tela de login e modelo de assinatura

### Ação na tela

1. Abrir `http://localhost:3000/login`.
2. Apresentar brevemente o login do responsável.
3. Informar que a demonstração utilizará duas contas de exemplo, digitadas como em um acesso real.

### Fala sugerida

> O Bem Lembrado foi pensado como um serviço por assinatura. Por isso, além de validar as credenciais do responsável, o sistema também verifica a situação do plano contratado.

### Objetivo

Introduzir o modelo SaaS e explicar que a autenticação e a assinatura são verificações diferentes.

## 3. Cenário com assinatura vencida

### Credenciais

- E-mail: `vencido@bemlembrado.demo`
- Senha: `Demo123!`

### Ação na tela

1. Digitar o e-mail `vencido@bemlembrado.demo`.
2. Digitar a senha `Demo123!`.
3. Clicar em **Entrar**.
4. Mostrar a tela de assinatura suspensa.
5. Destacar que os dados continuam preservados.
6. Mostrar as opções de renovação, suporte e saída da conta.

### Fala sugerida

> Neste exemplo, o e-mail e a senha estão corretos. O acesso não foi recusado por erro de autenticação: ele foi suspenso porque a assinatura venceu. Os dados e lembretes permanecem preservados, mas o painel e os novos envios ficam temporariamente bloqueados.

> A partir daqui, o cliente poderá renovar o plano ou entrar em contato com o suporte. Nesta versão de apresentação, a renovação é simulada; futuramente ela será integrada a um provedor de pagamentos.

### Resultado esperado

O sistema deve abrir a tela **Sua assinatura venceu**, sem permitir acesso direto ao dashboard.

### Mensagem principal para a banca

O produto possui um modelo de receita recorrente e uma regra clara de controle de acesso sem apagar os dados do cliente inadimplente.

## 4. Retorno ao login

### Ação na tela

1. Clicar em **Sair e usar outra conta**.
2. Confirmar o retorno para a tela de login.

### Fala sugerida

> Agora vamos entrar com uma conta que possui uma assinatura ativa para conhecer o funcionamento do produto.

## 5. Cenário com assinatura ativa

### Credenciais

- E-mail: `ativo@bemlembrado.demo`
- Senha: `Demo123!`

### Ação na tela

1. Digitar o e-mail `ativo@bemlembrado.demo`.
2. Digitar a senha `Demo123!`.
3. Clicar em **Entrar**.
4. Confirmar a entrada no dashboard.

### Fala sugerida

> Com a assinatura ativa, o responsável entra normalmente no painel. Para a apresentação, esta conta utiliza dados fictícios e não acessa informações ou telefones reais.

### Resultado esperado

O dashboard deve ser exibido com os dados demonstrativos.

### Mensagem principal para a banca

As contas de apresentação são isoladas dos dados reais e permitem demonstrar o produto com segurança.

## 6. Visão geral do dashboard

### Ação na tela

1. Mostrar a quantidade de lembretes realizados.
2. Mostrar os próximos lembretes.
3. Mostrar a quantidade de pessoas acompanhadas.
4. Apontar a agenda com horários e estados.

### Fala sugerida

> Esta é a visão geral do responsável. Ele consegue identificar rapidamente o que já foi realizado, quais lembretes estão próximos e quantas pessoas estão sendo acompanhadas.

### Objetivo

Apresentar o painel como o ponto central de acompanhamento da rotina.

## 7. Cadastro e contratação de uma nova assinatura

### Ação na tela

1. Voltar à tela de login.
2. Clicar em **Criar minha conta**.
3. Mostrar os dados solicitados ao responsável.
4. Apresentar o **Plano Família** e a cobrança mensal.
5. Explicar o aceite dos termos e da política de privacidade.
6. Criar a conta e avançar para a ativação da assinatura.
7. Usar o pagamento simulado do MVP para liberar o painel.

### Fala sugerida

> O cadastro não libera o produto automaticamente. Primeiro o responsável cria sua conta, escolhe o plano e aceita as condições da cobrança recorrente. Depois da confirmação do e-mail, ele segue para o pagamento da assinatura.

> Nesta versão, o checkout é simulado para demonstrar o fluxo completo. Na operação comercial, essa etapa será processada por um provedor de pagamentos seguro.

### Resultado esperado

A conta recém-criada permanece com assinatura pendente até a ativação. Após o pagamento simulado, o responsável é direcionado ao dashboard.

### Mensagem principal para a banca

O modelo de monetização por assinatura está integrado ao fluxo de entrada do produto, e não aparece apenas como uma ideia externa ao sistema.

## 8. Simulação de ausência de resposta

### Ação na tela

1. Abrir a aba **Simulação**.
2. Enviar o lembrete para a pessoa assistida.
3. Selecionar **Avisar responsável**.
4. Clicar em **Sem resposta**.
5. Acompanhar na linha de eventos o encerramento do prazo, a nova tentativa e o aviso final.
6. Mostrar brevemente as alternativas **Apenas registrar** e **Alerta prioritário**.

### Fala sugerida

> Se a pessoa assistida não responder, o sistema não conclui imediatamente que algo deu errado. Primeiro ele aguarda o prazo configurado e realiza as novas tentativas. Depois, aplica a regra escolhida pelo responsável: apenas registra, envia um aviso comum ou envia um alerta prioritário.

> A mensagem comunica somente a ausência de resposta e recomenda contato. O Bem Lembrado não afirma que um medicamento deixou de ser tomado nem classifica a situação como emergência.

### Resultado esperado

A linha do tempo deve mostrar **lembrete enviado → prazo encerrado → nova tentativa → último prazo encerrado → ação final**. No modo de aviso, a mensagem deve aparecer no telefone do responsável.

## Próximas etapas a incorporar ao roteiro

Os itens abaixo serão detalhados quando seus respectivos fluxos forem revisados e aprovados:

- Cadastro de uma pessoa assistida e contato autorizado.
- Criação de um lembrete.
- Demonstração do cenário de confirmação.
- Cenário em que a pessoa confirma o lembrete.
- Cenário sem resposta e alerta ao responsável.
- Pedido de ajuda feito pela pessoa assistida.
- Histórico e acompanhamento dos resultados.
- Explicação da integração com o WhatsApp.
- Encerramento, benefícios e próximos passos do produto.

## Controle de evolução do roteiro

| Etapa | Situação | Observação |
|---|---|---|
| Login com assinatura vencida | Pronta | Fluxo demonstrativo implementado |
| Renovação simulada | Pronta | Ainda sem provedor de pagamento |
| Login com assinatura ativa | Pronta | Utiliza dados fictícios |
| Visão geral do dashboard | Pronta | Conteúdo básico para apresentação |
| Cadastro e contratação da assinatura | Pronta | Checkout simulado no MVP |
| Cadastro de pessoa assistida | A revisar | Incluir após validação do fluxo |
| Criação de lembrete | Pronta | Inclui três regras para ausência de resposta |
| Simulador de conversas | Pronta | Cenário sem resposta e escalonamento implementados |
| WhatsApp real | Futuro | Depende da integração oficial e infraestrutura |

## Observações para quem estiver apresentando

- Explicar primeiro o valor para o usuário e depois a parte técnica.
- Não afirmar que a ausência de confirmação significa uma emergência.
- Reforçar que o Bem Lembrado apoia a rotina, mas não substitui atendimento médico.
- Evitar usar dados reais durante a demonstração.
- Se algum serviço externo estiver indisponível, continuar pela simulação local.
