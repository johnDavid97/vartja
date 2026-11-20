import { validations, type PasswordFieldValidation } from "payload";

export const ADMIN_PASSWORD_MIN_LENGTH = 15;

/** Payload's native password rules plus the administrator minimum for newly supplied passwords. */
export const validateAdministratorPassword: PasswordFieldValidation = (value, options) => {
  const nativeResult = validations.password(value, {
    ...options,
    minLength: ADMIN_PASSWORD_MIN_LENGTH,
  });

  if (nativeResult !== true) return nativeResult;
  if (value !== undefined && value !== null && typeof value !== "string") {
    return options.req.t("validation:invalidInput");
  }
  return true;
};
