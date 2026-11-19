import { commentResponse } from "@/features/comments/http";

type Context = { params: Promise<{ postId: string }> };
async function handle(request: Request, { params }: Context) {
  return commentResponse(request, { kind: "post", id: (await params).postId });
}
export { handle as GET, handle as POST, handle as PATCH };
