---
title: "There's no escaping it: an exploration of ANSI codes"
description: "A brief history of ANSI escape codes, how they work under the hood, and why this decades-old standard still makes your terminal colorful today."
---

ANSI escape codes are kinda crazy, no? I mean, crazy in the sense that they are such a simple and enduring concept. Every time your terminal renders bold red text or a progress bar crawls across the screen, you're taking advantage of a standard that is almost 50 years old. I'm not the biggest computing history buff, but I think understanding and admiring these standards can give us a greater appreciation for our industry, and a sense of how the standards that we are building today might scale for the next fifty years of computing. With that in mind, let's dive into ANSI escape codes.

## How they work

Back before I existed as a physical concept on Earth, terminals were physical devices: CRT monitors connected to mainframes via serial cables. These "dumb terminals" could display text, but that was about it. The standard that codified ANSI escape codes emerged as a reaction to the limitations of this medium. Plain-text was the only available transport format in use and these terminals could only process the text stream character-by-character. The standard described a format that allowed text streams to encode additional behavior for terminals to support: the ability to control cursor position, text formatting, and colors.

The terminal consumes a text stream that might contain special character sequences that represent these ANSI codes. Modern terminal emulators read the stream character by character, and when it hits an escape sequence, it interprets it as a command rather than displaying it. 

An ANSI escape sequence starts with the ESC character (ASCII 27, or `\x1b` in hex) followed by a left bracket `[`, forming what's called the Control Sequence Introducer (CSI). After that comes the actual command. For example:

- `\x1b[31m` sets the text color to red
- `\x1b[1m` makes text bold
- `\x1b[0m` resets all formatting
- `\x1b[2J` clears the entire screen
- `\x1b[H` moves the cursor to the top-left corner

You can combine multiple attributes by separating them with semicolons. So `\x1b[1;31m` gives you bold red text. The `m` at the end is the Select Graphic Rendition (SGR) command, which handles all the styling stuff.

The original spec defined 8 colors (black, red, green, yellow, blue, magenta, cyan, white), but modern terminals have expanded this significantly. The 256-color mode uses codes like `\x1b[38;5;208m` for extended colors. True 24-bit color support looks like `\x1b[38;2;255;128;0m` for RGB values.

## Why they matter

A standard from 1979 is still the backbone of how we interact with CLIs today. When you see colorized output from a command or progress indicators when executing a long-running command, that's ANSI codes at work. If you've styled your shell with a custom prompt, you've also taken advantage of these ANSI codes for background and foreground colors.

ANSI codes are so enduring a standard that they've received a modern refresh. Packages like [Spectre.Console](https://spectreconsole.net/) in .NET or [chalk](https://github.com/chalk/chalk) in Node expose helpers for interacting with these ANSI codes from user-authored applications. Many of them expose super sophisticated (well, in comparison to whatever was happening in 1979) patterns for rendering spinners and bouncers by using cursors moves and rewrites to edit content in place. If you've used the `aspire deploy` command, you can see how these patterns can be composed for rather colorful and interactive UIs. You can read more about that in [one of my earlier posts](/2025/10/27/aspire-deploy-cli-ux/).

Even fancier terminal UIs, like Vim and htop, extend the ANSI codes for cursor positioning and screen manipulation further by providing full-screen interactive experiences. They take advantage of sequences like `\x1b[10;20H` that indicate how your cursor should move. In this case, the numerals indicate the cursor should move to row 10, column 20. Combined with the ability to clear lines and draw characters, you can build surprisingly sophisticated interfaces using nothing but text streams.

## Try it yourself

I built a little interactive widget below where you can experiment with different escape sequences and see how they render in real-time. You can see how font styles, foreground and background colors, and cursor movements result in different ANSI escape codes.

<iframe src="/vpty/index.html" width="100%" style="border: none; display: block;" scrolling="no" onload="this.style.height=this.contentWindow.document.documentElement.scrollHeight+'px';"></iframe>

The next time you're admiring colorful terminal output, you'll know exactly what incantations are making it happen.

P.S. This blog post was largely an excuse to show the little interactive UI above. As a serial backend baddie (alliteration and a pun? unreal!), I'm trying to get better at developing design taste by building small learning interactions like this. I got the chance to finally play around with Tailwind as part of building this out and it was decently fun. Full disclosure, AI did most of the code writing here. The heavy lifting I did was mostly around figuring out how the experience should look here. Let me know if this obviously looks like it was built by somebody who spends most of their time looking at text.
