ALTER TABLE "payments" RENAME COLUMN "paypal_order_id" TO "provider_payment_id";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "paypal_payer_id" TO "provider_payer_id";