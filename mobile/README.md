# Saath Android app

This folder packages the existing Saath web app in a Capacitor Android shell.

## Build a debug APK in GitHub Actions

1. Open the repository's **Actions** tab.
2. Select **Build Saath Android APK**.
3. Tap **Run workflow** (or wait for the first push-triggered run).
4. When the run succeeds, download the **Saath-debug-APK** artifact.

The artifact is a debug APK for testing, not a Play Store release.

## Important before real use

- Google sign-in currently redirects to the existing GitHub Pages website. Native-app OAuth deep-link handling and Supabase redirect allow-list configuration still need to be completed and tested before this APK can be considered ready.
- AdMob is not added yet. Ad unit IDs and native ad integration must be configured after the Android shell and sign-in flow are validated.
- This build does not publish the app or incur Play Console charges.
