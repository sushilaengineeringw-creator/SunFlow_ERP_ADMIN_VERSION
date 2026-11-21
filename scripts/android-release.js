// Patches the generated Android project for a Google Play release (run in CI after `npx cap add android`).
const fs=require('fs');const vc=process.argv[2]||'1',vn=process.argv[3]||'1.0';
const m='android/app/src/main/AndroidManifest.xml';let x=fs.readFileSync(m,'utf8');
x=x.replace('android:allowBackup="true"','android:allowBackup="false"'); // keeps the licence / device id out of Google auto-backup
fs.writeFileSync(m,x);
const g='android/app/build.gradle';let b=fs.readFileSync(g,'utf8');
b=b.replace(/versionCode\s+\d+/,'versionCode '+vc).replace(/versionName\s+"[^"]*"/,'versionName "'+vn+'"');
if(!/signingConfigs/.test(b)){
  b=b.replace(/buildTypes\s*\{/,"signingConfigs {\n        release {\n            storeFile file('upload.jks')\n            storePassword System.getenv('KS_PASS')\n            keyAlias System.getenv('KEY_ALIAS')\n            keyPassword System.getenv('KEY_PASS')\n        }\n    }\n    buildTypes {");
  b=b.replace(/release\s*\{(\s*)minifyEnabled/,"release {$1signingConfig signingConfigs.release\n            minifyEnabled");
}
fs.writeFileSync(g,b);console.log('Android project patched: versionCode '+vc+', versionName '+vn);
