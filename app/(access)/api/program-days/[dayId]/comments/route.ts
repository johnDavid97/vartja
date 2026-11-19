import { commentResponse } from "@/features/comments/http";

type Context = { params: Promise<{ dayId: string }> };
async function handle(request: Request, { params }: Context) {
  return commentResponse(request, { kind: "program-day", id: (await params).dayId });
}
export { handle as GET, handle as POST, handle as PATCH };
