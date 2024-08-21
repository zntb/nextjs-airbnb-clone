"use server";
import { db } from "@/lib/db";
import { LISTINGS_BATCH } from "@/utils/constants";
import { getCurrentUser } from "./user";

export const getListings = async (query?: {
  [key: string]: string | string[] | undefined | null;
}) => {
  try {
    const {
      userId,
      roomCount,
      guestCount,
      bathroomCount,
      country,
      startDate,
      endDate,
      category,
      cursor,
    } = query || {};

    let where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (category) {
      where.category = category;
    }

    if (roomCount) {
      where.roomCount = {
        gte: +roomCount,
      };
    }

    if (guestCount) {
      where.guestCount = {
        gte: +guestCount,
      };
    }

    if (bathroomCount) {
      where.bathroomCount = {
        gte: +bathroomCount,
      };
    }

    if (country) {
      where.country = country;
    }

    if (startDate && endDate) {
      where.NOT = {
        reservations: {
          some: {
            OR: [
              {
                endDate: { gte: startDate },
                startDate: { lte: startDate },
              },
              {
                startDate: { lte: endDate },
                endDate: { gte: endDate },
              },
            ],
          },
        },
      };
    }

    const filterQuery: any = {
      where,
      take: LISTINGS_BATCH,
      orderBy: { createdAt: "desc" },
    };

    if (cursor) {
      filterQuery.cursor = { id: cursor };
      filterQuery.skip = 1;
    }

    const listings = await db.listing.findMany(filterQuery);

    const nextCursor =
      listings.length === LISTINGS_BATCH
        ? listings[LISTINGS_BATCH - 1].id
        : null;

    return {
      listings,
      nextCursor,
    };
  } catch (error) {
    return {
      listings: [],
      nextCursor: null,
    };
  }
};

export const getListingById = async (id: string) => {
  const listing = await db.listing.findUnique({
    where: {
      id,
    },
    include: {
      user: {
        select: {
          name: true,
          image: true,
        },
      },
      reservations: {
        select: {
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  return listing;
};

export const createListing = async (data: { [x: string]: any }) => {
  const {
    category,
    location: { region, label: country, latlng },
    guestCount,
    bathroomCount,
    roomCount,
    image: imageSrc,
    price,
    title,
    description,
  } = data;

  Object.keys(data).forEach((value: any) => {
    if (!data[value]) {
      throw new Error("Invalid data");
    }
  });

  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized!");

  const listing = await db.listing.create({
    data: {
      title,
      description,
      imageSrc,
      category,
      roomCount,
      bathroomCount,
      guestCount,
      country,
      region,
      latlng,
      price: parseInt(price, 10),
      userId: user.id,
    },
  });

  return listing;
};

export const updateListing = async (
  listingId: string,
  data: { [x: string]: any },
) => {
  const {
    category,
    location = {}, // Default location to an empty object
    guestCount,
    bathroomCount,
    roomCount,
    image: imageSrc,
    price,
    title,
    description,
  } = data;

  const { region, label: country, latlng } = location; // Destructure from location after assigning default

  if (!listingId) {
    throw new Error("Listing ID is required");
  }

  Object.keys(data).forEach((value: any) => {
    if (data[value] === undefined || data[value] === null) {
      delete data[value];
    }
  });

  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized!");

  const listing = await db.listing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    throw new Error("Listing not found");
  }

  if (listing.userId !== user.id) {
    throw new Error("You are not authorized to update this listing");
  }

  const updatedListing = await db.listing.update({
    where: { id: listingId },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(imageSrc && { imageSrc }),
      ...(category && { category }),
      ...(roomCount !== undefined && { roomCount }),
      ...(bathroomCount !== undefined && { bathroomCount }),
      ...(guestCount !== undefined && { guestCount }),
      ...(country && { country }),
      ...(region && { region }),
      ...(latlng && { latlng }),
      ...(price && { price: parseInt(price, 10) }),
    },
  });

  return updatedListing;
};
