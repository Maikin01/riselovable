import { createAdminClient } from "../_shared/supabase.ts";
import {
  ApiHttpError,
  createHttpContext,
  errorResponse,
  json,
  options,
} from "../_shared/http.ts";
import {
  assertMercadoPagoPaymentContract,
  getPayment,
  verifyMercadoPagoWebhookSignature,
} from "../_shared/mercadopago.ts";
import {
  applyProviderPaymentStatus,
  finalizePaymentIfApproved,
} from "../_shared/payments.ts";
import { clientIp, enforceRateLimit } from "../_shared/rate-limit.ts";
import { deliverMarketplaceOrder } from "../_shared/marketplace.ts";

Deno.serve(async (request) => {
  const http = createHttpContext(request, "public");
  if (request.method === "OPTIONS") return options(http);
  if (request.method === "GET") return json({ ok: true }, 200, http);

  try {
    if (request.method !== "POST") {
      throw new ApiHttpError(
        405,
        "METHOD_NOT_ALLOWED",
        "Método não permitido.",
      );
    }
    const admin = createAdminClient();
    await enforceRateLimit(
      admin,
      "mercadopago-webhook",
      [clientIp(request)],
      600,
      60,
      {
        failOpen: true,
        requestId: http.requestId,
      },
    );
    const url = new URL(request.url);
    const text = await request.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    
    // Log do corpo recebido para debug em logs do Supabase
    console.log(`[mercadopago-webhook] Received body: ${JSON.stringify(body)}`);

    const rawResource = body?.resource;
    const resourcePaymentId = typeof rawResource === "string"
      ? rawResource.match(/(?:payments|notifications)\/([0-9]+)(?:\?.*)?$/i)?.[1] ??
        (/^[0-9]+$/.test(rawResource) ? rawResource : null)
      : null;
    
    // Preferir data.id se disponível (webhook V2)
    const paymentId = body?.data?.id ??
      resourcePaymentId ??
      url.searchParams.get("id") ??
      url.searchParams.get("data.id") ??
      url.searchParams.get("data_id");
    
    const topic = body?.type ?? body?.topic ?? url.searchParams.get("topic") ??
      url.searchParams.get("type");

    if (!paymentId) {
      console.warn("[mercadopago-webhook] Missing paymentId in request");
      return json({ ok: true, ignored: "missing id" }, 200, http);
    }

    // Se o tópico for fornecido e não for 'payment', ignoramos
    if (topic && !String(topic).includes("payment")) {
      return json(
        { ok: true, ignored: `topic ${String(topic).slice(0, 128)}` },
        200,
        http,
      );
    }

    const hasSignatureHeaders = !!request.headers.get("x-signature") &&
      !!request.headers.get("x-request-id");
    
    // Verificação de assinatura
    const signature = await verifyMercadoPagoWebhookSignature(request, String(paymentId));
    if (!signature.configured) {
      console.warn(
        "[mercadopago-webhook]",
        JSON.stringify({
          requestId: http.requestId,
          code: "WEBHOOK_SECRET_NOT_CONFIGURED",
        }),
      );
    } else if (hasSignatureHeaders && !signature.valid) {
      console.error(`[mercadopago-webhook] Invalid signature for paymentId=${paymentId}`);
      throw new ApiHttpError(
        401,
        "INVALID_WEBHOOK_SIGNATURE",
        "Assinatura inválida.",
      );
    }

    // Buscar detalhes reais do pagamento na API do MP (segurança e dados completos)
    const remote = await getPayment(String(paymentId));
    const providerId = String(remote.id);
    const externalReference = remote.external_reference
      ? String(remote.external_reference)
      : null;
    
    console.log(`[mercadopago-webhook] Processing providerId=${providerId}, extRef=${externalReference}, status=${remote.status}`);

    // Fluxo Marketplace
    if (externalReference && externalReference.startsWith("mkt_")) {
      const orderId = externalReference.slice(4);
      const { data: order, error: orderError } = await admin
        .from("marketplace_orders")
        .select("id, status, amount_cents")
        .eq("id", orderId)
        .maybeSingle();
      
      if (orderError) throw orderError;
      if (!order) return json({ ok: true, ignored: "order_not_found" }, 200, http);
      
      if (String(remote.status) === "approved") {
        console.log(`[mercadopago-webhook] Marketplace order ${orderId} approved. Delivering...`);
        await deliverMarketplaceOrder(admin, order.id);
      } else if (
        ["cancelled", "rejected", "refunded", "charged_back"].includes(
          String(remote.status),
        )
      ) {
        await admin
          .from("marketplace_orders")
          .update({ status: "cancelled" })
          .eq("id", order.id)
          .eq("status", "pending");
      }
      return json({ ok: true, marketplace: true }, 200, http);
    }

    // Fluxo Licenças de Planos
    // Tenta primeiro pelo externalReference (nosso ID de pagamento interno)
    const { data: payment, error } = externalReference
      ? await admin.from("payments").select("*").eq("id", externalReference).maybeSingle()
      : await admin.from("payments").select("*").eq("provider_payment_id", providerId).maybeSingle();
    
    if (error) throw error;
    if (!payment) {
      console.warn(`[mercadopago-webhook] Payment not found for extRef=${externalReference} or providerId=${providerId}`);
      return json({ ok: true, ignored: "not_found" }, 200, http);
    }

    // Validar contrato do pagamento (valor, email se disponível, etc)
    const verified = assertMercadoPagoPaymentContract(remote, {
      paymentId: payment.id,
      providerPaymentId: payment.provider_payment_id,
      amountCents: payment.amount_cents,
      buyerEmail: payment.buyer_email,
    });

    // Atualizar status no banco
    const effectiveStatus = await applyProviderPaymentStatus(admin, {
      paymentId: payment.id,
      providerPaymentId: verified.providerId,
      status: verified.status,
      raw: remote,
    });

    // Se aprovado, garantir a geração das chaves
    if (effectiveStatus === "approved") {
      console.log(`[mercadopago-webhook] Finalizing payment ${payment.id} for approved status.`);
      // O quantity é respeitado aqui
      await finalizePaymentIfApproved(admin, payment.id, payment.quantity ?? 1);
    }

    return json({ ok: true }, 200, http);
  } catch (error) {
    console.error(`[mercadopago-webhook] Error processing webhook: ${error.message}`, error);
    return errorResponse(error, http);
  }
});