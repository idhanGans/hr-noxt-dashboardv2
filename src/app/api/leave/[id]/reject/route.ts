import { decideLeave } from "@/lib/api/leave";

export const dynamic = "force-dynamic";

// POST /api/leave/[id]/reject — manager only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return decideLeave(req, id, "rejected");
}
