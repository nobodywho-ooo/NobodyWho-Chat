clean:
	watchman watch-del-all && watchman shutdown-server

clean-cache:
	npm start -- --reset-cache

clean-start:
	npx react-native start --reset-cache

ios-clean:
	cd ios && rm Podfile.lock && rm -rf Pods && pod install && cd ..