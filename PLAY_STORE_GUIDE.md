# Publishing SunFlow ERP on Google Play – checklist

**Honest status:** the app and the release workflow are prepared, but the signed release build could not be run here – run it once and send me the log if it fails. Approval is decided by Google; this checklist removes the usual reasons for rejection.

## 1. Technical requirements (checked)
| Requirement | How it is met |
|---|---|
| Target API level 36 (required for new apps/updates since 31 Aug 2026) | `release-aab.yml` builds with Capacitor 8 (compileSdk/targetSdk 36, Java 21, Node 22). The old `build.yml` (APK for sideloading) is unchanged. |
| Signed Android App Bundle (.aab) | `release-aab.yml` signs with your **upload key** read from GitHub *Secrets* (never stored in the repository). |
| Permissions | Only INTERNET. No camera/storage/location permission. |
| No cloud auto-backup of licence data | `android:allowBackup="false"` set in both workflows. |
| Increasing version | You enter `versionCode` (must increase each upload) and `versionName` when you run the workflow. |
| Application ID | `com.sushila.suryagharcalc` (set in `capacitor.config.json`; cannot be changed after publishing). |

## 2. Create the upload key (once, on a computer with Java)
```
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks     # (Windows PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")))
```
GitHub repo → Settings → Secrets and variables → Actions → New secret: `KEYSTORE_B64` (the base64 text), `KS_PASS`, `KEY_ALIAS` (upload), `KEY_PASS`. **Keep upload.jks and its passwords safe** (backup offline).

## 3. Build
GitHub → Actions → **Release AAB (Google Play)** → Run workflow (versionCode 1, versionName 9.0.0) → download `SunFlow-ERP-release-aab` → `app-release.aab`.

## 4. Play Console (new app)
1. Create app → App access: choose **"All or some functionality is restricted"** and give reviewers a working **test login**: create a *Demo* user in your Admin panel (30 days, all modules) and enter the activation code + mobile + password in the instructions. Keep that demo licence active during review.
2. Privacy policy: publish `docs/privacy-policy.html` (edit placeholders; e.g. GitHub Pages) and paste the URL; also put it in `www/config.js` → `SEW_PRIVACY_URL`.
3. Data safety form (matches the app): data collected – *Device or other IDs* (licence/device ID), *Personal info: phone number & e-mail* (licence record, password reset), *Messages: feedback*, *Files* (optional encrypted backup). Purposes: app functionality / account management. Not sold, not shared. Encrypted in transit: yes. You can request deletion: yes (privacy policy contact).
4. Content rating questionnaire (business app – no objectionable content), target audience 18+, no ads.
5. Store listing: icon 512×512 = `assets/sunflow-icon-512.png`; feature graphic 1024×500 and 2–8 phone screenshots (take them from the app); short & full description.
6. Testing: new personal developer accounts must first run a **closed test** with the number of testers/days Google currently requires before production access – check Play Console for the current rule. Organization accounts have different rules.
7. App signing: accept **Play App Signing**; upload the `.aab`.

## 5. Things Google reviewers check
* App opens and works with the supplied test login; licence lock screen text is clear; no crashes.
* Privacy policy link works and matches the Data safety answers.
* No misleading claims (the app does not claim government filing; GST reports are summaries).
* Payments: subscriptions are collected outside the app by UPI. Google may require Play Billing for in-app digital goods; if Play objects, tell me and we will adapt (this is a policy risk to check with Google).
