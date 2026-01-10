---
layout: post
title: What happens when you run `sudo !!`?
date: '2018-05-09T17:03:32-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/173746752130/what-happens-when-you-run-sudo
---
One thing I’m sure everyone has done on the command line is to use the `!!` shortcut to run the command run previously with sudo.

    $ gimme-the-secrets
    You can't run this command.
    $ sudo !!
    The answer to life, the universe, and everything is 42.

This blog post is gonna deviate a little bit from what I usually do because the logic for the `!!` shortcut doesn’t utilize any system calls so looking at the stack trace wouldn’t yield anything illuminating.

The `!!` command leverages the `history` file in which Bash maintains a record of the commands executed by the user. You can find the location of this file by running the following command.

    $ echo $HISTFILE
    /home/captainsafia/.bash_history

I started off the investigation by running `type` on `!`.

    $ type !
    ! is a shell keyword

This makes sense. `!` is a shell-level construct that is part of the shell’s grammar. I suspect that the shell manages to replace any commands that reference “!” with the prior command executed. I’m actually still murky on this. I decided to hop over to the [bash code base](https://github.com/bminor/bash) to see if I could dissect this a little bit.

I started by looking for references to “!” in the code base, but that didn’t come up with anything because it probably would be referenced using a word, not a symbol (symbol in the normal sense, not the computer science one). I tried looking for “exclamation” and “keyword” but came up with nothing. Then I finally realized that it would probably be referenced using “bang” in the code base and got some useful snippets to look at from that.

It turns out that the ability to expand `!` as a reference to an element in the history is governed by the `-H` flag that can be passed to a new bash instance and sets the `BASH_HISTORY` flag to true.

Some more snooping led me to the `bashhist.c` [file](https://github.com/bminor/bash/blob/7de27456f6494f5f9c11ea1c19024d0024f31112/bashhist.c) in the source code which managers interactions with the history file. I started snooping around this file to see if I could find anything that was responsible for taking the “!” in a command and replacing it appropriately.

I found a promising result in the [`pre_process_line`](https://github.com/bminor/bash/blob/7de27456f6494f5f9c11ea1c19024d0024f31112/bashhist.c#L517) which handles expanding “!” into the most recent history entry. The function checks to see if history expansion is enabled in the current bash session and invokes the `history_expand`.

    # if defined (BANG_HISTORY)
      /* History expand the line. If this results in no errors, then
         add that line to the history if ADDIT is non-zero. */
      if (!history_expansion_inhibited && history_expansion && history_expansion_p (line))
        {
          expanded = history_expand (line, &history_value);

I read through the code for the `history_expand` function and it essentially translates all the different forms of “!” that can be used, like “!!” to access the last command or “!2” to access the second command in the history file, into the actual commands that are referenced and returns them as a new string to be parsed by the shell.

So in summary, when you type “sudo !!” the following happens.

1. Bash begins pre-processing the line.
2. If history expansion is enabled, Bash passes the “!!” string to the `history_expand` function which returns the last item in the history file.
3. Bash begins pre-processing that new line. Since it has no history expansion strings in it, it just executes the commands referenced within.
4. Fin.

Of course, there’s a lot more edge-casing checking and other business happening, but the above steps get to the meat of the process.

See you in the next post!

