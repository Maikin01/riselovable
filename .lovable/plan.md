# Plano de Correção: Pagamentos Pix Presos em Pendente

O usuário relatou que, mesmo após o pagamento do Pix, o sistema continua exibindo o status "Aguardando pagamento". Isso geralmente ocorre devido a falhas na entrega do Webhook do Mercado Pago ou na sincronização entre o provedor e o banco de dados.

## Alterações Técnicas

### 1. Robustez na Consulta de Status (Backend)
- **Arquivo**: `supabase/functions/backend-api/index.ts`
- **Ação**: Aprimorar a função `getCheckoutStatus` para forçar uma consulta direta à API do Mercado Pago sempre que o status local for `pending`.
- **Objetivo**: Garantir que, se o webhook falhar, a primeira vez que o usuário (ou o sistema de polling) consultar o status, o sistema se auto-corrija buscando a verdade no provedor.

### 2. Sincronização no Dashboard
- **Arquivo**: `supabase/functions/backend-api/index.ts` (ação `getMyDashboard`)
- **Ação**: Garantir que o `reconcilePendingPayments` seja chamado de forma eficiente ao carregar o dashboard.
- **Objetivo**: Limpar pagamentos pendentes que já foram pagos assim que o usuário loga.

### 3. Ajuste de Validação de Contrato
- **Arquivo**: `supabase/functions/_shared/mercadopago.ts`
- **Ação**: Tornar a comparação de e-mail ainda mais resiliente. O Mercado Pago às vezes mascara e-mails em consultas via API (ex: `m***@gmail.com`), o que causava falha na validação de segurança `PAYMENT_CONTRACT_MISMATCH`.
- **Objetivo**: Evitar que pagamentos legítimos sejam rejeitados por pequenas divergências de formatação de e-mail no retorno da API.

### 4. Melhora no Polling do Frontend
- **Arquivo**: `src/components/checkout/PixCheckoutDialog.tsx` e `src/components/checkout/MarketplacePixDialog.tsx`
- **Ação**: Aumentar a frequência de verificação inicial e garantir que o estado de "sucesso" seja refletido imediatamente após a detecção no backend.

## Verificação
1. Simulação de pagamento aprovado via API do provedor.
2. Verificação se o RPC `finalize_approved_payment_bulk` é disparado corretamente.
3. Confirmação de que a chave é exibida no modal sem necessidade de refresh manual da página.
