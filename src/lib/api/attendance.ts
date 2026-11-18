import { z } from "zod";

import type { attendanceRecords } from "@/db/schema";

export const attendanceWriteSchema = z.object({
  date: z.string().min(1),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  status: z.enum(["present", "remote", "late", "absent", "on_leave"]),
  workedHours: z.number().optional(),
  location: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  locationOut: z.string().optional(),
  gpsOutLat: z.number().optional(),
  gpsOutLng: z.number().optional(),
  method: z.enum(["office", "gps", "biometric"]).optional(),
});

export type AttendanceWriteInput = z.infer<typeof attendanceWriteSchema>;

export type AttendanceRow = {
  a: typeof attendanceRecords.$inferSelect;
  employeeCode: string | null;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
};

export function shapeAttendance(row: AttendanceRow) {
  return {
    id: String(row.a.id),
    employeeId: row.employeeCode ?? String(row.a.employeeId),
    employeeName: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    department: row.department ?? "",
    date: row.a.date,
    clockIn: row.a.clockIn ?? undefined,
    clockOut: row.a.clockOut ?? undefined,
    status: row.a.status,
    workedHours: row.a.workedHours != null ? Number(row.a.workedHours) : 0,
    location: row.a.location ?? "",
    gpsLat: row.a.gpsLat ?? null,
    gpsLng: row.a.gpsLng ?? null,
    locationOut: row.a.locationOut ?? "",
    gpsOutLat: row.a.gpsOutLat ?? null,
    gpsOutLng: row.a.gpsOutLng ?? null,
    method: row.a.method ?? "office",
  };
}
