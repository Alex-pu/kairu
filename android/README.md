# Escrow Android App

Native Android client (Kotlin + Jetpack Compose + Retrofit) mirroring the website's user-facing
features: register/login, escrow list, create escrow (deposit), transaction detail with timeline,
confirm-received (release), open dispute, and rate.

## Open / build

This is a standard Gradle Android project. Easiest path:

1. Open the `android/` folder in **Android Studio** (Hedgehog or newer). It will download the
   Gradle wrapper, Android SDK, and dependencies on first sync.
2. Run the app on an emulator or connected Android phone.

From the command line (with a local Gradle 8.7+ or after Studio generates the wrapper):

```
cd android
gradle wrapper        # first time only, to create ./gradlew
./gradlew assembleDebug
```

> The `gradle/wrapper/gradle-wrapper.jar` binary is intentionally not committed; generate it with
> `gradle wrapper` or let Android Studio create it on first open.

## API base URL

Set in [app/build.gradle.kts](app/build.gradle.kts) as `API_BASE`. Defaults to
`https://app.sasalink.co.ke/api/`, so generated APKs talk to the live VPS by default.

For local emulator testing, override the API at build time:

```
./gradlew assembleDebug -PapiBase=http://10.0.2.2:4000/api/
```

`10.0.2.2` is how the Android emulator reaches `localhost` on the host machine. For a physical
device against a local backend, use your machine's LAN IP. For production, use HTTPS.

## APK outputs

Debug APK, signed by the Android debug key and installable for testing:

```
app/build/outputs/apk/debug/app-debug.apk
```

Release APK, optimized but unsigned until you configure a release keystore:

```
app/build/outputs/apk/release/app-release-unsigned.apk
```

## Structure

```
app/src/main/java/com/safepay/escrow/
  MainActivity.kt          # entry point + theme
  data/
    Models.kt              # @Serializable DTOs mirroring the API
    ApiService.kt          # Retrofit endpoints
    ApiClient.kt           # Retrofit/OkHttp builder, auth header, error parsing
    Session.kt             # JWT storage + claim decoding (userId, role, expiry)
  ui/
    AppViewModel.kt        # state, navigation, all API calls
    Screens.kt             # Compose screens: auth, dashboard, new escrow, detail
```

The app decodes the JWT to know the current user id (buyer vs seller framing); the backend enforces
all authorization.
