---
layout: post
title: 'A blast from the past: Node.JS'
date: '2018-04-02T09:18:50-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172519463425/a-blast-from-the-past-nodejs
---
In my [last blog post](https://blog.safia.rocks/2018-03-30-looking-at-the-first-commit-of-redux/), I traveled to the past and checked out the code associated with the first commit of the [Redux](https://github.com/reactjs/redux) code base. It’s a different style of code reads for me, but it turned out to be quite fun and interesting. I figured I would do the same things this time. for the [Node](https://github.com/nodejs/node) code base.

Sidebar: When I posted my last blog post, I got a couple of comments to the effect of “Why would someone push complete code in their first commit?” Most people are most likely used to using Git to push their own projects to GitHub, not necessarily with the intention of making it something that other people will immediately be able to collaborate with. I think it depends on goals and intentions, but I generally will commit code and documentation with my initial commit so that individuals can immediately start using and contributing to the project.

The initial public commit made to the Node code base was committed on February 16th, 2009.

    commit 9d7895c567e8f38abfff35da1b6d6d6a0a06f9aa (HEAD)
    Author: Ryan <ry@tinyclouds.org>
    Date: Mon Feb 16 01:02:00 2009 +0100
    
        add dependencies

As the commit message denote, the initial commit added dependencies to the project. These [dependencies](https://github.com/nodejs/node/tree/9d7895c567e8f38abfff35da1b6d6d6a0a06f9aa/deps) were added as [Git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules). As it turns out, the Git repositories references as Git submodules no longer exist, so exploring the code base for this commit is not that interesting.

The commit immediately following the first commit was much more interesting.

    commit 61890720c8a22a7f1577327b32a180a2d267d765 (HEAD)
    Author: Ryan <ry@tinyclouds.org>
    Date: Mon Feb 16 01:34:45 2009 +0100
    
        add readme and initial code

Alright! That definitely looks much more interesting. There’s two C source files in this initial commit: [server.cc](https://github.com/nodejs/node/blob/61890720c8a22a7f1577327b32a180a2d267d765/server.cc) and [js\_http\_request\_processor.cc](https://github.com/nodejs/node/blob/61890720c8a22a7f1577327b32a180a2d267d765/js_http_request_processor.cc).

The second file is responsible for using the V8 JavaScript engine to parse and interpret a JavaScript source file. The first file is responsible for running a small HTTP server written in C++.

I tried to take a stab at actually running the source files provided in this directory. The one big hurdle was the fact that the submodules referenced had been moved to different locations. Namely, the ebb dependency [has been transferred to a different GitHub organization[([https://github.com/taf2/libebb](https://github.com/taf2/libebb)) and I had trouble tracking down where the other `liboi` dependency was (although [this](https://cs.fit.edu/code/projects/cse2410_fall2014_bounce/repository/revisions/90fc8d36220c0d66c352ee5f72080b8592d310d5/show/deps/liboi) seemed to be the closest thing I could find).

I tried to see if I could find the earliest commit that didn’t utilize these dependencies but they stick around the code base for a while. Browsing through the early commits on the project didn’t turn out to be a trivial exercise. I got the chance to see how the code base progressed in the early days.

    $ git log --pretty=oneline --abbrev-commit
    90ea571602 (HEAD) request.respond(null) sends eof
    096384ad58 gitignore
    cc1a61c1e7 request.respond works
    74f4eb9a2e add http method access
    b518ed9db2 add some printfs..
    7b7ceea4ec first compile
    4a5bab8ef6 intermediate commit. nothing works.
    6ded7fec5f ...
    61890720c8 add readme and initial code
    9d7895c567 add dependencies

You can see the refactors and cleanups that occur as the code base matured. I also like that fact that some of the commits are associated with code that doesn’t compile. As someone who always strives to make “perfect commits,” I enjoyed seeing this authenticity from a relatively well-known developer in the JavaScript industry.

Anyways, I took another stab at trying to get the `61890720c8` commit to compiling and managed to transfer over the dependencies without using submodules. As it turns out, even after including the dependencies, there was still a lot of hassle to get `make` to run correctly. Each of the dependencies had its own set of dependencies that were difficult to track down and so on. I guess I should limit my skillset to reading code that is about a decade old instead of getting it to compile (granted things could be worse).

Some more digging revealed that the `liboi` dependency is now the `evcom` dependency (which has evolved dramatically since).

So, in summary:

- The first commits of the Node.js code base were experimental and included refactors and not-exactly-working commits.
- Some of the critical dependencies of the project have evolved A LOT in the past 10-ish years.

I know this blog post was a little all over the place and that is admittedly because there wasn’t a lot to dig into (especially with the long-lost dependencies). Maybe I’ll get luckier with the next code base I do some archaeology on…

