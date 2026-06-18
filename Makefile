clean:
	watchman watch-del-all && watchman shutdown-server

clean-cache:
	npm start -- --reset-cache

clean-start:
	npx react-native start --reset-cache

ios-clean:
	cd ios && rm Podfile.lock && rm -rf Pods && pod install && cd ..

android-apk:
	export JAVA_HOME=$$(/usr/libexec/java_home -v 21) && \
	cd android && ./gradlew assembleRelease
	open android/app/build/outputs/apk/release/

android-aab:
	export JAVA_HOME=$$(/usr/libexec/java_home -v 21) && \
	cd android && ./gradlew bundleRelease
	open android/app/build/outputs/bundle/release/