export {
  AuthorizationError,
  authorizeTrustedOperation,
  maskLearnerExport,
  roles,
  trustedOperations,
} from "./trusted-boundary.js";

export { authorizeCallableOperation } from "./firebase-authorizer.js";

export type {
  ActiveAdminRecord,
  AuthorizationGrant,
  AuthorizationRequest,
  LearnerExportRow,
  Role,
  SafeLearnerExportRow,
  TrustedAuthContext,
  TrustedOperation,
} from "./trusted-boundary.js";
