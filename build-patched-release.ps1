# PowerShell script to automate the build-patch-build process for React Native Android release
cd android
./gradlew assembleRelease
cd ..
node patch-autolinking-cmake.js
cd android
./gradlew assembleRelease 