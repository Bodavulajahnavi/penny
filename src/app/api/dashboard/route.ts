import { getDashboardData } from "@/lib/data";
import { requireUser, handleApiError, ApiError } from "@/lib/auth";
import { currentMonth, validMonth } from "@/lib/finance";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const month = new URL(request.url).searchParams.get("month") || currentMonth();
    if (!validMonth(month)) throw new ApiError(400, "Choose a valid month.");
    return Response.json(await getDashboardData(user, month), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
