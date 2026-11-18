import { decideReimbursement } from "@/lib/api/reimbursements";

export const dynamic = "force-dynamic";

// POST /api/reimbursements/[id]/approve — manager only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return decideReimbursement(req, id, "approved", new Date());
}
