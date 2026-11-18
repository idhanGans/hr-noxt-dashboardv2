ALTER TABLE "attendance_records" ADD COLUMN "location_out" text;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "gps_out_lat" double precision;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "gps_out_lng" double precision;