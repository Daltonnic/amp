import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native app configuration (iOS + Android).
 *
 * appId is the permanent store identifier (iOS bundle ID / Android
 * applicationId). It cannot change after the first store release — confirm it
 * before you upload. See docs/APP_STORE_RELEASE.md.
 */
const config: CapacitorConfig = {
  appId: 'org.apostolicmoralpurity.app',
  appName: 'AMP',
  webDir: 'dist',
  backgroundColor: '#f3f4f7',
  loggingBehavior: 'debug',
  ios: {
    // The web layer handles safe areas with env(safe-area-inset-*).
    contentInset: 'never',
    backgroundColor: '#f3f4f7',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#f3f4f7',
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SystemBars: {
      // Edge-to-edge on Android 15+; the app pads itself via safe-area insets.
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      // Hidden from JS once the app has rendered (src/app/AppShell.tsx).
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: '#f3f4f7',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      // Show group notifications as banners even while AMP is open.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_amp',
      iconColor: '#d4632a',
    },
    PrivacyScreen: {
      enable: true,
    },
  },
}

export default config
