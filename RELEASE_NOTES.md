# SunFlow ERP v9.0 – release notes

## The 10 developments
1. **Forgot password** – Users: enter the registered mobile number → a 6-digit code is e-mailed (Google MailApp from your Gmail, ≤1 code/min, valid 10 min, blocked after 5 wrong tries) → set a new password. The admin can also e-mail-register users and **reset a password** from the Admin panel. **Admin:** a one-time **recovery code** (created at owner setup, renewable in Settings › Licence & security) lets the admin set a new password offline. *SMS OTP is not included* (needs a paid SMS gateway), and an e-mail/SMS code cannot unlock the admin key, which never leaves the phone.
2. **Companies & FY** – One app name (“SunFlow ERP”, one line). **Multiple companies**: each has its own data; add / switch / delete in Settings › Companies or by tapping the company name under the app name; licence, users and theme are shared. The **Financial-year dropdown moved to Settings** (a chip on each page opens it); the app still opens on the current FY.
3. **Light mode by default** (a theme you choose afterwards is remembered).
4. **Restore → sync → reports** – after every restore (and on demand in Settings › Backup) the app re-links parties/items from restored invoices, moves numbering past restored numbers, rebuilds all reports, verifies that register = customer-wise = monthly totals, flags undated records, and offers **“Download all reports (Excel)”** – one workbook with a sheet per report.
5. **Invoice register** – fixed column widths, centred headers, customer / details limited to two lines, chronological order (oldest first), 50 rows per page.
6. **Purchase bills** – same treatment; the description column is capped at two lines.
7. **Real dates** – dates are read in every common format (dd-mm-yyyy, dd/mm/yy, 15-Apr-2026, Excel serials…). A bill or invoice without a date is **never given today's date**; it appears under “No date”. Graphs have a **Monthly / Quarterly / Yearly** switch, always by invoice date; new Monthly, Quarterly and Yearly summary reports; the FY always shows its 12 months / 4 quarters.
8. **Demo notice** – one thin continuous right-to-left text line (DEMO VERSION · start · expiry · days left · offline / renewal notes). No window, no overlay.
9. **Stability & performance** – 248 automated checks; paged registers (only one page is drawn), debounced saving, `allowBackup` off, safe restore with safety copy. Measured in tests: 22 reports on 900 invoices + 900 bills + 600 register rows + 120 customers in ~0.2 s, registers ~65 ms, dashboard ~0.3 s, backup + checksum ~30 ms, server list of 1,500 users ~11 ms (50 per page).
10. **Admin panel** – one compact line per user (name · status · days left), tap to open full details and actions; server-side search, status filter and paging (50 per page) for 1,000+ users. Fixed a bug where the **Modules** sheet also picked up the “New user” tick-boxes (duplicates / extra modules).

## Google Play
`PLAY_STORE_GUIDE.md`, `docs/privacy-policy.html` (template), `scripts/android-release.js` and `.github/workflows/release-aab.yml` (signed .aab, Capacitor 8 = Android API 36, Java 21, secrets from GitHub). **Untested here** – I could not run an Android build; run it once and send me the log if it fails. Approval is Google's decision; the guide covers the usual rejection reasons (target API, privacy policy, Data safety, reviewer login, permissions).

## Known limitations (not faked)
* No real multi-device sync; data stays on each phone. Cloud backup (encrypted, Drive) is the supported alternative. A modified APK can remove the lock screen.
* SMS OTP not included. E-mail OTP needs the licence server and a registered e-mail.
* Auto backup can run only when the app is open (Android).
* GST reports are reference summaries; P&L = recorded sales vs purchases only; no expense register / cash book / stock.
* The “All reports” Excel and the Play Store files could not be tried on a phone here.

## Tests – last run: **248 passed, 0 failed** (`cd tests && npm install && npm test`)
