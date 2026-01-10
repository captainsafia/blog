---
layout: post
title: Curling up with the `curl` code base
date: '2018-04-16T10:07:15-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172996589235/curling-up-with-the-curl-code-base
---
Randomly the other day, I was wondering (when is anything I wonder not random?) how browsers work. Correction: I was wondering what happens when you enter a URL into your browser and hit “Enter.” I wasn’t wondering about the DNS resolutions or TCP connections or other networking related aspects around the Internet. I was wondering how a browser connects all of this into a single application. I’ve learned about these concepts before, but I’ve always wondered how they are all connected into a single, functional application.

As per usual, I want to learn more about this by reading the source code for an application. At first, I figured I might read the code for Chromium or Firefox or some other open source browser. Then I realized that there was probably a lot of code in these applications that would cloud my analysis of the networking aspect of this. Instead, I figured that I would try to figure out how these concepts connect by looking at the code base for `curl`.

`curl` is a command line tool that allows the user to transfer data from one server to another. Although it is often used to query sites through the hypertext transfer protocol (HTTP), you can actually use it transfer data through other protocols as well, like FTP. I actually didn’t know this before starting this exploration so I guess that’s one new thing learned!

Anyways, to get started, I want to figure out what happens when I run the following on the command line.

    $ curl https://safia.rocks

This command print the HTML source for my personal website to the console. You can try it and see.

The source code for `curl` is hosted on [GitHub](https://github.com/curl/curl). The first order of business was to find the entry point for the `curl` executable. I snooped around the source code to try to find this.

Sidebar: I use the phrase “snooped around” a lot in these blog posts. Generally, it means looking through directories, reading the first couple of lines in files that I think might be related to what I want, and reading through the source for header files.

After poking around for a little bit, I started to notice some trends in how the source code for `curl` is structured. In particular, the source code associated with the command line tool is sprinkled around files under the `src/tool_*.c` path. This includes code that parses parameters, prints out the help statement, processes the URLs passed into `curl`, and interfaces with libcurl.

Sidebar: When I refer to `curl`, I am referring to the command line tool. There is also `libcurl` which is the library that contains the code for handling all the transfer protocols.

Once I figured out this `src/tool_*.c` pattern, it didn’t take long for me to find the entry point of the command line tool. It’s located in the `main` function of the [`src/tool_main.c`](https://github.com/curl/curl/blob/36f0f47887563b2e016554dc0b8747cef39f746f/src/tool_main.c#L241-L282) file. Sweet! Now, we can get to the fun parts.

The most critical code referenced in this function is the following.

    /* Start our curl operation */
    result = operate(&global, argc, argv);

So, it looks like most of the heavy lifting is done by the vaguely named `operate` function.

Sidebar: The `argc` and `argv` parameters are self-explanatory. The `global` parameter is a reference to the global configuration for `curl` which is the `.curlrc` file stored in the users home directory by default.

Alright! So It’s time to look into the `operate` function which is defined in the [`src/tool_operate.c`](https://github.com/curl/curl/blob/36f0f47887563b2e016554dc0b8747cef39f746f/src/tool_operate.c) file. I decided to start my exploration by looking at the function declaration for the `operate` function.

    CURLcode operate(struct GlobalConfig *config, int argc, argv_item_t argv[])

In particular, I was interested in the `CURLcode` object that is returned from the function. I tried to find the definition of this object somewhere in the code base. I assumed that it would be a struct so I searched for that definition. The query I was using to look for the struct definition didn’t turn up anything (I actually looked for it using the command line on a local copy of curl). Instead, I opted for the documentation on `CURLcode` which I found [here](https://curl.haxx.se/libcurl/c/libcurl-errors.html). So it turns out that a CURLcode is actually an enum-like structure which contains integer representations of different possible error codes that might occur in `curl`. This makes sense when you consider the fact that most (all) C functions return their status using integers and the fact tha the result of the `operate` function is typecast into an integer in the return for the entry point of the main function for `curl`.

Alright! This blog post is getting a little long so in the next blog post, I’ll dive into the meat of the `operate` function and try to analyze what’s going on there. So I don’t lead myself to far astray, I’d like to answer the following questions as I’m reading through the code.

1. What calls to the `libcurl` are made in the `operate` function?
2. What preprocessing, if any, is done to the arguments passed to the `operate` function?

See you in the next blog post!

