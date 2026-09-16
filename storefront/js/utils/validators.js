// Small, stateless helpers for the signup/login forms. No Supabase
// calls here — that stays in authService.js.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value.trim());
}

export function passwordsMatch(password, confirmPassword) {
  return password === confirmPassword;
}
