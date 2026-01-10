---
title: The anti-prompt shell prompt
description: Embrace tradition, reject modernity, let go of that noisy crap in your shell.
tags: [shell, workflow, minimalism, fish]
---

I've been embracing minimalism more and more in my workflow lately. As time has gone on, I've tweaked my VS Code config to remove more and more UI elements. It started with removing the status bar, then the gutter, then the activity bar, and so on. This inclination to strip down the user interfaces that I interact with most frequently to their barest parts comes out of a complete dissatisfaction with just how _noisy_ so many apps are these days. Even your favorite editor will insist on overwhelming your periphery with a lot of noise but not enough signal. So I throw all of it out.

Recently, I reached the ultimate state of minimalism nirvana by changing my shell prompt to a simple `%`. Here it is in action:

![](/assets/images/2025-09-22-terminal-screenshot.png)

It's actually a little bit more than just a plain old `%`. I've set up my Fish function to change the prompt color on each line for a little bit of razzle-dazzle. This is achieved by the Fish function below, which you can find the latest iteration of in [my dotfiles repo](https://github.com/captainsafia/dotfiles/blob/main/fish/functions/fish_prompt.fish).

```fish
function fish_prompt --description "Percent-only prompt with changing color"
    set colors red green yellow blue magenta cyan \
               brred brgreen bryellow brblue brmagenta brcyan \
               white brwhite black brblack

    set color $colors[(math (random) % (count $colors) + 1)]

    set_color $color
    printf "%% "
    set_color normal
end
```

It's so simple and satisfying. Now, if you're the kind of person who's used to a busier shell, you might take serious issue with this prompt. How do I know what working directory I am in? How do I know if my git repo is dirty? How do I know what git branch I'm on?

Here's my take on all that: most of these things are information that you only need to know when you need to know it.

In my own workflows, I only care about how dirty my git repo is when I am preparing to stage and commit some changes, and that's usually an intentional process. My current working directory? I have it configured to display in my Ghostty window title, and that's usually enough visibility into it. Figuring out what branch I am currently on? Calling `git branch` is quick enough and doesn't require me to pay the cost of having additional noise in my terminal.

One of the big value props of terminal-based experiences, in my opinion, is the fact that commands are quick to execute, composable, and customizable. It's possible to create and save shorthands for a number of actions. That means it's really easy to build flows that implement a pull-based model for getting the information you need about the current environment that you are in, instead of a push-based model.

That's it. That's the rant.
