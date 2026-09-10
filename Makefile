# --- Caches -----------------------------------------------------------------
# Try these in order: clean-cache first, clean-metro if that wasn't enough,
# clean-watchman for the recrawl warning. clean-all does the lot.

# Delete Metro's on-disk caches outright. For when --reset-cache wasn't enough:
# a bundle that keeps serving stale modules, or "Unable to resolve module" for
# a file that demonstrably exists. Stop the packager first.
clean-metro:
	rm -rf "$$TMPDIR"metro-cache "$$TMPDIR"metro-file-map-*

# Drop watchman's watches and stop its server; the next Metro start re-crawls
# from scratch. Useful after a big npm install
clean-watchman:
	watchman watch-del-all && watchman shutdown-server

# Reinstall the iOS pods from scratch. For native-side breakage only — a pod
# that won't link, a stale xcframework, Podfile.lock drift after a dependency
# change. Unrelated to the JS caches above, and by far the slowest of these.
ios-clean:
	cd ios && rm Podfile.lock && rm -rf Pods && pod install && cd ..

# Every clean above, in dependency order
clean-all:
	$(MAKE) clean-watchman
	$(MAKE) clean-metro
	$(MAKE) ios-clean


# --- Android release builds -------------------------------------------------

android-apk:
	export JAVA_HOME=$$(/usr/libexec/java_home -v 21) && \
	cd android && ./gradlew assembleRelease
	open android/app/build/outputs/apk/release/

android-aab:
	export JAVA_HOME=$$(/usr/libexec/java_home -v 21) && \
	cd android && ./gradlew bundleRelease
	open android/app/build/outputs/bundle/release/

.PHONY: clean-cache clean-metro clean-watchman ios-clean clean-all \
	android-apk android-aab
