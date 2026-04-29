clean:
	watchman watch-del-all && watchman shutdown-server

ios-clean:
	cd ios && rm ios/Podfile.lock && rm -rf ios/Pods && pod install && cd ..