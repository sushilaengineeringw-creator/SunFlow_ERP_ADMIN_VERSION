# Upgrade, data migration and rollback (v8 → v9)

* Install the new APK **over** the old one (same package id and `debug.keystore`). **First export a backup file** (Menu › Backup / Restore).
* Existing data becomes the first company (“c1”, same storage key as before). Nothing is deleted or recalculated. Licence users/plans move to a shared store (`sew_adm2`); the theme choice is kept app-wide (`sew_pref`); everyone opens in Light mode once after the upgrade.
* Bills / invoices that had no date keep their financial year and are shown under “No date” – they are no longer treated as uploaded today.
* Update the server: paste the new `server/Code.gs`, then **Deploy › Manage deployments › edit › New version** (URL unchanged). New columns (e-mail, password override, OTP) are added automatically. Allow the Gmail send permission when asked (for the password-reset e-mail).
* **Rollback:** install the previous APK; if it does not start, uninstall it, install the old APK and restore the backup. v9 backups restore into v8 (extra keys are ignored).
