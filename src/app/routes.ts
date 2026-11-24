export const paths = {
  welcome: '/welcome',
  signIn: '/sign-in',
  resetPassword: '/reset-password',
  home: '/home',
  checkIn: '/check-in',
  grounding: '/grounding',
  journal: '/journal',
  group: '/group',
  resources: '/resources',
  library: '/library',
  triggers: '/triggers',
  identity: '/identity',
  accountability: '/accountability',
  settings: '/settings',
  privacy: '/privacy',
} as const

/** Base44 page URLs → new paths, so old links and bookmarks keep working. */
export const legacyRedirects: Record<string, string> = {
  '/Onboarding': paths.welcome,
  '/CheckIn': paths.checkIn,
  '/TriggerAwareness': paths.triggers,
  '/IdentityFormation': paths.identity,
}
