ALTER TABLE "employees" ADD COLUMN "auth_user" text;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_auth_user_unique" UNIQUE("auth_user");