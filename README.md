Sure, here's the revised README.md with better formatting:

# 🔥Mill Heaters🔥

Welcome to Athom Homey's support for the sensational [Mill WiFi](https://www.millheat.com/mill-wifi/) heaters! 

## 📱Supported Devices

In theory, all Mill WiFi heaters should be on our compatibility list. However, our awesome community has tested and reported the following devices to be working perfectly:
* AV600WIFI
* AV800LWIFI
* AV1000LWIFI
* AV1200WIFI
* NE600WIFI
* NE1200WIFI

## 🃏Flow Cards
Our module is a champ! Not only does it support all normal thermostat triggers, conditions, and actions, it also has a few special ones up its sleeve.

**Supported triggers:**
* Thermostat mode has changed
* Thermostat mode has changed to <mode>

**Supported conditions:**
* Thermostat is/isn't heating
* Thermostat mode is/isn't <mode>

**Supported actions:**
* Set thermostat mode

## ⚙️Setup

Time to start the engines! Open Settings and enter your Mill credentials before trying to add any Mill heaters.

## 🎚️Device Settings

Default power consumption is set to a whopping 1200W. Please tweak this to match your model in the device's advanced settings.

## 💼Usage

The Mill service is designed with three modes - _Comfort_, _Sleep_ and _Away_ (and a secret _Holiday_ mode hidden in the API, but not supported in the Mill UI yet😉).

Mode change alert!🔔 When you change the mode, the temperature shifts to that mode's temperature set point. Adjusting the temperature changes the set point for that mode. 

Choose the _Program_ mode and watch the Mill service take control, adjusting the mode throughout the day according to the program you set up on the Mill app. The device will then shift to the current thermostat mode.

## 🌍Supported Languages

* English
* Norwegian
* Dutch

## 🔒Privacy

This app uses [sentry.io](http://sentry.io) to log exceptions and errors. By installing this app, you agree that the app may send error logs to Sentry. Rest assured, no personal or device information, such as email, passwords, Homey identification etc., is ever sent, only logs related to errors. This includes exception messages, parts of source code, line numbers, app version etc.

## ⚠️Disclaimer

Remember, use this app at your own risk. The app has been developed with the same APIs and interfaces used by the official Mill app. However, there is a tiny chance that the API calls can have unexpected consequences, for which you're the captain of the ship!

## 🔄Change Log:

##### v1.0.8
* Updated temperature change endpoint
* Improved feedback on errors

##### v1.0.7
* Added more languages
* Improved logging
* Validated Mill API requests

##### v1.0.6
* Added support for Energy (may require re-pairing if device is added prior to version 1.0.6)
* Fixed issues with flows with multiple devices
* Added Norwegian and Dutch
* Added single click on/off

##### v1.0.5
* Support for new app store

##### v1.0.4
* Changed Mill endpoint
* Fixed problems where heaters couldn't be reinstalled after being deleted
* Fixed problems with flow cards

##### v1.0.3
* Fixed "Set mode" problems with flow cards

##### v1.0.0
* Added logging interface

##### v0.0.2
* Added Sentry logging

##### v0.0.1
* First version

## 👏Credits

Special thanks to [Stan Diers](https://thenounproject.com/search/?q=heat&i=860995) from the Noun Project for the 'Heat' icon.