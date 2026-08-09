# Escrow Android App

Native Android client (Kotlin + Jetpack Compose + Retrofit) mirroring the website's user-facing
features: register/login, escrow list, create escrow (deposit), transaction detail with timeline,
confirm-received (release), open dispute, and rate.

## Open / build

This is a standard Gradle Android project. Easiest path:

1. Open the `android/` folder in **Android Studio** (Hedgehog or newer). It will download the
   Gradle wrapper, Android SDK, and dependencies on first sync.
2. Start the backend so the API is reachable, then Run the app on an emulator.

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
`http://10.0.2.2:4000/api/` — `10.0.2.2` is how the Android **emulator** reaches `localhost` on the
host machine. For a physical device, use your machine's LAN IP (and serve the API over HTTPS in
production; `usesCleartextTraffic` is enabled only for local development).

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
