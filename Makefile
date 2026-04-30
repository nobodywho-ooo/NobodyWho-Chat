clean:
	watchman watch-del-all && watchman shutdown-server

ios-clean:
	cd ios && rm Podfile.lock && rm -rf Pods && pod install && cd ..