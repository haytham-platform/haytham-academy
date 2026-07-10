import type { AcademyInfo } from "@/types";

export const ACADEMY: AcademyInfo = {
  name: "أكاديمية هيثم التعليمية",
  nameEn: "Haytham Academy",
  phone: "0676955623",
  address: "حي الشهداء، طريق الحمام، بجانب قهوة بلولي، حاسي خليفة",
};

export const JWT_COOKIE_NAME = "haytham_token";
export const AUTH_SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * AUTH_SESSION_DAYS;
export const JWT_EXPIRES_IN = `${AUTH_SESSION_DAYS}d`;
