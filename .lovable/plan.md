# Plano de Correção: Licenças de Curta Duração marcadas como Vitalícias

O problema ocorre porque o sistema de exibição e cálculo de expiração não estava preparado para lidar com licenças que possuem uma duração customizada em minutos/dias, mas que ainda não foram ativadas. Quando uma licença é comprada via revenda com duração customizada, o campo `custom_duration_minutes` é preenchido, mas `expires_at` permanece nulo até a ativação na extensão. O frontend, ao ver `expires_at` nulo e um plano que não seja explicitamente "trial", acaba exibindo "Vitalícia" ou não mostrando a contagem regressiva corretamente.

## Alterações

### 1. Backend: Refinamento na geração de licenças
- Atualizar `supabase/functions/_shared/payments.ts` para garantir que `custom_duration_days` seja lido da tabela `payments` e passado corretamente para a função SQL `finalize_approved_payment_bulk`.

### 2. Frontend: Correção na exibição do Dashboard
- Modificar `src/routes/_authenticated/dashboard.tsx` para identificar licenças com `custom_duration_minutes` definido.
- Exibir a duração correta (ex: "7 dias", "30 dias") em vez de "Vitalícia" quando a licença ainda não foi ativada mas tem duração customizada.

### 3. Utilitários: Ajuste na formatação de datas
- Ajustar `src/lib/license-utils.ts` para melhor suporte a durações customizadas na listagem de licenças.

## Detalhes Técnicos
- O banco de dados já possui a coluna `custom_duration_minutes` na tabela `licenses`.
- A função SQL `finalize_approved_payment_bulk` já trata a conversão de `custom_duration_days` (do pagamento) para `custom_duration_minutes` (da licença).
- Vou garantir que o Dashboard mostre "Duração: X dias (inicia na ativação)" para licenças pendentes com duração customizada.
