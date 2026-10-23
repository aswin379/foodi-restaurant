// Auxiliary auth links. Each stays hidden until a real route exists for it,
// so the login page never links to a page that 404s.
export const authLinks: {
  forgotPassword: string | null
  restaurantOnboarding: string | null
  terms: string | null
  privacy: string | null
} = {
  forgotPassword: null,
  restaurantOnboarding: null,
  terms: null,
  privacy: null,
}
