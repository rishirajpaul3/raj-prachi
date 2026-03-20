ALTER TABLE "roles" ALTER COLUMN "employer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "apply_url" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "logo_url" text;--> statement-breakpoint
CREATE INDEX "roles_source_external_id_idx" ON "roles" USING btree ("source","external_id");