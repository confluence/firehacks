# Firehacks

## What is this?

A very minimalist collection of persistent CSS and JS customisations of Firefox that bypass the limited modern extension API (which caused a great extinction event of user control over the interface).

To celebrate the arrival of native vertical tabs in Firefox (only about 20 years late) I got rid of my third-party tab extension, and immediately missed the lack of per-domain colours.

I found out that it's still possible to re-enable `userChrome.js` functionality using an autoconfig hack, although it's really difficult to find out how exactly because so much information is a decade out of date. Then I set out to fix all the usability annoyances that I absolutely can't stand, some of which I've been fixing in a much less convenient way. I've got all the most important things working, and will probably extend this solution to a few more in future.

This is my personal set of tweaks, which I intend to maintain only for the latest version of Firefox on Ubuntu installed as a `deb` package from the Mozilla repo. Feel free to fork this repository and use these files as a starting point for your own tweaks, *entirely at your own risk*. These modifications are not officially supported by Mozilla. You might break something. Please back up your profile and don't run with scissors.

## Features

* Tab backgrounds are coloured by URI domain (or scheme if there is no domain).
* Clicking once in the URL bar or search bar never selects the contents.
* The search term is cleared from the search bar after the search is performed.
* Searches performed from the search bar always load in background tabs and never switch away from the currently selected tab.
* Unread tabs have an `unread` attribute again and can be styled. Tabs restored from a previous session start off as unread; you can exclude them with a different attribute.
* Tab styles for unread, selected, and hover.
* Webpage links on the new tab page have no titles.
* Pinned tabs are smaller and tab padding is reduced (and fixed).

## How to use

You need root access. I have no idea how to set this up on any system except my own, but it should go something like this:

* `firehacks.js` has to be in the same directory as the `firefox` executable. On Ubuntu with the `deb` package that's `/usr/lib/firefox/`.
* `autoconfig.js` has to be in `/defaults/pref/` relative to that directory.
* All the CSS files go in the `chrome` subdirectory of your Firefox profile.
* You have to enable `toolkit.legacyUserProfileCustomizations.stylesheets` in `about:config`.
* There are two preferences for these tweaks:
    * `extensions.firehacks.num_hues`: how many different hues to use to colour tabs (minimum: 1; maximum: 360)
    * `extensions.firehacks.hue_offset`: an offset to apply to the hues (in degrees)
* If you change anything in any of these files, or the preferences, you have to restart Firefox for the changes to be applied.

## How to develop

I recommend enabling the Browser Toolbox, and using it in conjunction with the browser console. There are lots and lots of legacy user scripts online to examine for examples of similar code. Some of them use old APIs and don't work at all, but some work with minor modifications.

## Alternatives

There are multiple generic loaders which restore the functionality of loading arbitrary scripts from the `chrome` directory in your profile, and collections of updated scripts made to work with them. I decided that they were overengineered and undersecured for my simple use case, hence this project.

## Possible future work

* Make prefs apply immediately, for easier testing
* Extend mouse gestures only to restricted pages
* Basic related tab grouping / indentation; would need to integrate with reordering
* Refactoring into a separate object
* Integration with other extensions

## Recommended related extensions

* [uniqtabs](https://addons.mozilla.org/en-US/firefox/addon/uniqtabs/), a small extension that deduplicates and sorts your tabs. It didn't play nicely with the vertical tab extension, but it works great with the native tabs and the colours and now I use it all the time.
* [Foxy Gestures](https://addons.mozilla.org/en-US/firefox/addon/foxy-gestures/) for mouse gestures.
* [Violentmonkey](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/), for user content scripts.
* [Stylus](https://addons.mozilla.org/en-US/firefox/addon/styl-us/), for user content styles.
