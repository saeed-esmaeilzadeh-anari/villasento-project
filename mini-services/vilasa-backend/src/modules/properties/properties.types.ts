import type { SafeUser } from "../../common/session.middleware";

export type SearchParams = {
  q?: string;
  cityId?: string;
  provinceId?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string[]; // amenity keys
  types?: string[];
  instantOnly?: boolean;
  verifiedOnly?: boolean;
  featuredOnly?: boolean;
  sort?: "RECOMMENDED" | "PRICE_ASC" | "PRICE_DESC" | "RATING" | "NEWEST";
  page?: number;
  pageSize?: number;
};

export type PropertyInput = {
  title?: string;
  type?: string;
  description?: string;
  cityId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  capacity?: number;
  bedrooms?: number;
  beds?: number;
  basePrice?: number;
  weekendPrice?: number;
  cleaningFee?: number;
  deposit?: number;
  minNights?: number;
  checkInTime?: string;
  checkOutTime?: string;
  rules?: string;
  cancelPolicy?: string;
  instantBooking?: boolean;
  images?: string[];
  amenityKeys?: string[];
  submit?: boolean; // true → send to review (PENDING)
};

export type { SafeUser };
