---
layout: post
title: What I learned when I tried to hack my smart vibrator
date: '2017-12-11T09:37:45-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/168431307225/what-i-learned-when-i-tried-to-hack-my-smart
---
I’ve owned a smart vibrator for a little over a year now. For those of you who might not be familiar, smart vibrators are vibrators that can be controlled by an app via a Bluetooth connection. Often times, the app is connected to the Internet so a remote user can control the vibrator via the app. In that case, the remote user sends a message to the app and the app relays that message to the vibrator via Bluetooth.

I don’t do a lot of interesting projects with hardware or Internet connected devices, so I figured it would be fun to hack into my vibrator to learn a bit more about IoT devices. In this specific case, by&nbsp;"hack"&nbsp;I mean&nbsp;"reverse engineer the communication protocols that the vibrator and app used to communicate with each other.“&nbsp;The particular vibrator I’ll be reverse engineering is the [Vibease](https://www.vibease.com/ordernow). Note to those of you who might be in an office, public library, or next to a nosy person on the train: that link will take you to an e-commerce page that sells sex toys. Hopefully, I saved you some unwanted awkwardness!

I started by doing a bit of research into Internet of Things devices that use Bluetooth in general. I figured, or I should say hoped, that there would be some sort of standardization or protocols around how Internet of Things devices utilize Bluetooth.

The first thing I figured out was the distinction between Bluetooth and Bluetooth Low Energy. Bluetooth Low Energy (sometimes referred to as Bluetooth 4.0) is a version of Bluetooth that uses less energy that prior versions. This is particularly advantageous for Internet of Things devices because it means they can run off battery for long periods of time. I can confirm this. I was pretty surprised by the number of uses that I could get out of my vibrator after a single full charge. This&nbsp;"low energy"&nbsp;distinction is a result of BLE modules remaining in&nbsp;"sleep mode"&nbsp;when not in use and thus using less energy. You can read a bit more about the differences at [this link](https://www.link-labs.com/blog/bluetooth-vs-bluetooth-low-energy).

I decided to look around and see if there were any other articles written about reverse engineering Internet of Things devices and chanced upon [this post](https://medium.com/@urish/reverse-engineering-a-bluetooth-lightbulb-56580fcb7546). In the post, the author reverse engineers a smart light bulb. At this point, I don’t have the knowledge to brag, but I get the sense that what I’m trying to do might be a bit more difficult. For one, while an app that controls the color of light bulb only need to modify the color presented by the LED, a vibrator consists of several motors that sometimes need to be activated in tandem. Despite this, the post gave me some pretty good insights into BLE devices in general.

In particular, the article outlined how a peripheral device (like a vibrator) uses BLE to connect to services that represent different aspects of the device (like the battery or the motors of a vibrator) to read and write certain characteristics (like the battery level of the device or the rotations per minute on a motor). The article mentioned using an app called NRF Connect to interface with the Bluetooth device. I headed over to the App Store on my iPhone, downloaded the app, turned on my vibrator, and connected to it using the app.

Once I connected to the vibrator, the app detected three different services. The first was the Battery Service and the second was the Device Information service. It was pretty obvious to deduce what each of these services were for from their names. I figured that they were both read-only services that allowed the app (and snoopy critters like me) to read information about the battery level and details about the vibrator. The third service was labeled as&nbsp;"Unknown"&nbsp;by the NRF Connect tool. I figured this is the service that is responsible for reading and writing the state of the motors on the vibrator.

![A screen capture of the services detected by the NRF Connect app on the Vibease vibrator.](https://cldup.com/IstyJ2nFQs.PNG)

I decided to navigate over the&nbsp;"Battery Service"&nbsp;to see what information I could find there. As I suspected, the&nbsp;"Battery Service"&nbsp;contains a single&nbsp;"Battery Level"&nbsp;characteristic that is&nbsp;"Read Notify"&nbsp;and contains a value of ‘0x64’. This is a hex (base 16) number that translates to 100 in decimal. It’s fully charged and ready to go!

![A screencapture of the Battery Level characteristic on a Vibease.](https://cldup.com/N1MASiuKMp.PNG)

I navigated to the&nbsp;"Device Information"&nbsp;service and noticed that it had several&nbsp;"Read"&nbsp;characteristics that pertained to the Serial Number, Model Number, and other details of the device. Here’s a screenshot of what that screen looked like with certain details obfuscated.

![A screencapture of the Device Information service on a Vibease.](https://cldup.com/LwCrj0carN.PNG)

All this was fairly easy, but I still needed to figure out how the app interfaced with the motors. I navigated to the ominously named&nbsp;"Unknown Service"&nbsp;to see if I could figure anything out.

![A screencapture of the motor services on a Vibease.](https://cldup.com/0WjjHQHlmB.PNG)

Interesting! This service contains a mix of&nbsp;"Read Notify"&nbsp;and&nbsp;"Write Without Response"&nbsp;characteristics. There are two&nbsp;"Read Notify"&nbsp;characteristics and two&nbsp;"Write Without Response"&nbsp;characteristics. I presume that each of those characteristics lines up with a motor on the vibrator. That is to say, the vibrator has two motors, each of which you can read data from and write data too. This was in line with the physical characteristics of the vibrator. It has a motor on each end, and they both operate independently of one another.

I noticed something a little strange with the two&nbsp;"Read Notify"&nbsp;characteristics that were associated with the motors. One characteristic read a value of '0x0000’ (The screen-capture above shows a value of '0x0100’ because I took it a while after I gathered the initial reading. I’m not sure why the value changed in the hour between me seeing it for the first time and me remembering to take the screenshot. More mysteries. Wow, this parenthetical is getting a little long…) which corresponded to a motor that was off (or, so I guess) and the other read a value of 'N/A’. At that point in time, the vibrator was on but not vibrating, so I found it strange that one motor would send a zero value and the other would send a null value. I decided to do a quick Google to see if this was a common issue with characteristic on BLE devices but couldn’t come up with anything useful.

Side note: Effective Googling is very difficult when you are learning something new, so I might not be formulating my queries in a way that brings up good responses. If you know something about BLE and why this might be happening, [do let me know](https://blog.safia.rocks/ask)!

Anyways, I noticed that the NRF Connect app provided an option to write to characteristics that were writable. At this point, I did what any good engineer would do, I tested out random values. I tried sending '0x64’ which corresponded with the decimal value 100 to see if the characteristic was setting the power level on the motor. No dice!

![A screencapture of writing 0x64 to a motor on a Vibease.](https://cldup.com/PzXe1iJLwa.PNG)

I noticed that the zero value being read by one of the characteristics was a hex number with 4 places, so I tried sending '0xffff’ but that didn’t work either. Bother!

![A screencapture of sending 0xffff to a Vibease.](https://cldup.com/TD27vLRTUe.PNG)

So at this point, I figured I would try something else. Instead of guessing values, I would open up the&nbsp;Vibease&nbsp;app on my phone, set the vibration on the app, and see what values the&nbsp;"Read Notify"&nbsp;characteristic emitted. The tricky thing was that I couldn’t use the NRF Connect and the&nbsp;Vibease&nbsp;app on my phone at the same time, so I had to figure out some way to connect to the vibrator from my laptop. I found an app called [LightBlue](https://itunes.apple.com/us/app/lightblue/id639944780?mt=12) on the Mac App Store and figured I could try to use that to read the values on each of the characteristics while I was controlled the vibrator from the app. For some strange reason, I couldn’t connect to the vibrator from my laptop while I was connected to it via the app on my phone. This actually isn’t strange, it makes total sense. If I were building a smart vibrator, I wouldn’t want multiple devices connected to it at the same time.

I decided to see if there were any Bluetooth sniffers for iOS. I wanted something that could run in the background and log all the messages sent over BLE from my phone. Knowing Apple’s focus on security, I figured that an app like this might not be available on an&nbsp;un-jailbroken&nbsp;iPhone but I tried my luck on it anyways. Some Googling led me to [this StackOverflow post](https://stackoverflow.com/questions/32134143/bluetooth-diagnostics-logs-on-ios) that provided some details about running Bluetooth in&nbsp;"Diagnostics Mode"&nbsp;on iOS. I wasn’t sure what kind of information I would be able to get out of the logs provided by Apple but I figured it was worth a shot. I ended up following the [official instructions for Bluetooth logging on iOS](https://download.developer.apple.com/iOS/iOS_Logs/Bluetooth_Logging_Instructions.pdf) linked to in the StackOverflow post to generate my log.

Side-note: What is it with Apple and all the outrageous key/button combinations they make you press to access diagnostic features on their products? I mean, I understand why they make it difficult for users to get to those features but&nbsp;geez&nbsp;I’m going to get arthritis by the end of all this!

The result of this diagnostic logging was a ’.tar.gz’ file located at the directory specified in the instructions referenced above. I unzipped the directory and discovered that it consisted of several diagnostics files.

![Too many files to look through.](https://cldup.com/tC69IjCMVF.png)

Oh boy, what did I get myself into now? At this point, I decided to utilize one of the most time-tested and expert-recommended problem solving techniques. It is called&nbsp;"click a bunch, read a bunch"&nbsp;and consists of opening and reading lots of files until you find one that makes sense.

I found a few files that seemed to be related to Bluetooth logging but opening them in&nbsp;Wireshark&nbsp;rendered some truly nonsensical data.

![A Bluetooth log opened in Wireshark](https://cldup.com/R4WEL6PARr.png)

I also found some files that referenced the&nbsp;Vibease&nbsp;app that I was using to control my vibrator. They ended up just being crash report files. It turns out that whenever I would try to connect to the vibrator from another device while the app was connected to it, the&nbsp;Vibease&nbsp;app would crash. Fun!

At this point, I’ve tried enough options to go back to the drawing board one more time. From doing some research, I [discovered](https://stackoverflow.com/questions/23877761/sniffing-logging-your-own-android-bluetooth-traffic) that sniffing BLE signals and getting a log that is fairly easy to parse in&nbsp;Wireshark&nbsp;was pretty trivial in Android. It felt like the Apple ecosystem was really limiting me here, then again I am new to this and might just be unaware of the right tools to use. I did some more Googling to see if there were any other Bluetooth sniffers available for iOS or Mac but didn’t run into anything. Most solutions recommended purchasing a device like the [Ubertooth One](https://greatscottgadgets.com/ubertoothone/), which is designed to help with Bluetooth experimentation. But this device has quite a hefty price tag. It retails for anywhere from 120 USD to 200 USD, a little out of my college student budget. I couldn’t find a way to sniff BLE signals on iOS from the phone the way it was done in Android.

I figure I would pause this little experiment here and post this blog post as is. If you consider yourself an expert in the Internet of Things and have some advice on how I should move forward, [do let me know](https://blog.safia.rocks/ask).

Although I didn’t reach my ultimate goal of reverse engineering the communication protocols used between my vibrator and its app, I learned quite a bit in this little adventure.

- There is a lot going on under the hood when we use devices with BLE connectivity. It reminds me a little bit of those pictures showing what the world would look like [if we could see WiFi signals](https://motherboard-images.vice.com/content-images/contentimage/no-slug/c476ab8ca7be6ae31670205374dc8309.jpg). There is so much information constantly being transmitted that we are figuratively and literally blind too.
- Running diagnostics on iOS apps yields a plethora of information. This is the first time I’ve profiled and logged my iPhone and it was interesting to see all the information available. I might end up doing something similar to diagnose issues with apps that I use that crash frequently. I might draft a blog post for it on here if I have the time.
- Reverse engineering is fun (and sometimes frustrating).

Until next time!

