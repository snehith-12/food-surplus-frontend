import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { apiError, apiSuccess } from "@/lib/api-utils";

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/claims/:id
 * Get a single claim by ID. Only the shelter or the listing donor can view.
 */
export async function GET(
  req: Request,
  { params }: RouteContext
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  try {
    const claim = await prisma.claim.findUnique({
      where: { id: params.id },
      include: {
        listing: {
          include: {
            donor: {
              select: {
                id: true,
                orgName: true,
                contactName: true,
                phone: true,
                address: true,
                city: true,
                state: true,
              },
            },
          },
        },
        shelter: {
          select: {
            id: true,
            orgName: true,
            contactName: true,
            phone: true,
          },
        },
      },
    });

    if (!claim) return apiError("Claim not found", 404);

    // Authorization: only the shelter or donor can view
    const isDonor = claim.listing.donorId === session.user.id;
    const isShelter = claim.shelterId === session.user.id;
    if (!isDonor && !isShelter) {
      return apiError("Not authorized to view this claim", 403);
    }

    return apiSuccess(claim);
  } catch (error: any) {
    console.error("[GET /api/claims/:id]", error);
    return apiError("Failed to fetch claim", 500);
  }
}
