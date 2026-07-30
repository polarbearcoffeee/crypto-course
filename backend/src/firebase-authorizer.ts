import { getFirestore } from "firebase-admin/firestore";
import {
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import {
  AuthorizationError,
  authorizeTrustedOperation,
  roles,
  type AuthorizationGrant,
  type Role,
  type TrustedOperation,
} from "./trusted-boundary.js";

type SensitiveOperationInput = {
  confirmed?: boolean;
  reason?: string;
};

function recognizedRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (candidate): candidate is Role =>
      typeof candidate === "string" &&
      (roles as readonly string[]).includes(candidate),
  );
}

function toHttpsError(error: unknown): never {
  if (!(error instanceof AuthorizationError)) {
    throw error;
  }

  const code =
    error.code === "unauthenticated"
      ? "unauthenticated"
      : error.code === "reauthentication-required"
        ? "failed-precondition"
        : error.code === "confirmation-required" ||
            error.code === "reason-required"
          ? "invalid-argument"
          : "permission-denied";

  throw new HttpsError(code, error.message);
}

/**
 * Entry guard for every callable function that performs a sensitive operation.
 *
 * The caller's custom claims are never trusted alone: this function loads the
 * server-owned administrator profile and delegates to the deterministic policy
 * boundary before any Admin SDK read or write is allowed.
 */
export async function authorizeCallableOperation(
  operation: TrustedOperation,
  request: CallableRequest<SensitiveOperationInput>,
): Promise<AuthorizationGrant> {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "A named administrator session is required.",
    );
  }

  const profile = await getFirestore()
    .collection("adminUsers")
    .doc(request.auth.uid)
    .get();
  const profileData = profile.data();

  try {
    return authorizeTrustedOperation({
      operation,
      auth: {
        uid: request.auth.uid,
        tokenRoles: recognizedRoles(request.auth.token.roles),
        authTimeSeconds:
          typeof request.auth.token.auth_time === "number"
            ? request.auth.token.auth_time
            : 0,
      },
      admin: profileData
        ? {
            status:
              profileData.status === "active" ||
              profileData.status === "invited" ||
              profileData.status === "suspended" ||
              profileData.status === "revoked"
                ? profileData.status
                : "revoked",
            roles: recognizedRoles(profileData.roles),
          }
        : null,
      nowSeconds: Math.floor(Date.now() / 1000),
      confirmed: request.data.confirmed === true,
      reason: request.data.reason,
    });
  } catch (error) {
    return toHttpsError(error);
  }
}
