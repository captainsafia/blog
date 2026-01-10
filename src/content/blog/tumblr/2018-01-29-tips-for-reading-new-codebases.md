---
layout: post
title: Tips for reading new codebases
date: '2018-01-29T10:00:54-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/170269021619/tips-for-reading-new-codebases
---
So, I’ve been running around reading codebases for a while now, and I thought it would be a good time to compile some of what I had learned about how to read and understand a codebase. I should note that these tips are specifically related to reading a codebase with the intention of learning how it works. They might come useful when reading a codebase with the purpose of modifying it, but your mileage may vary when implementing these lessons for that pursuit.

Anyways! Enough chit-chat. Here’s a listicle all about the things I learned about how to read a codebase.

1. Reading a codebase is a lot like peeling an onion. It helps me when I start by reading the code associated with the public-facing API and tracing it back to internal functionality.
2. Function follows form. The way source directories are arranged, or the order in which functions are defined in a source file tells a lot about the structure of the call tree and the hierarchy of imports in a project. This is assuming that the codebase is structured well. Most of the time, it is and looking at the structure informs a lot about the function.
3. `git blame` is your best friend. No, no! Not to figure out who introduced a bug (well maybe sometimes) but to figure out who solved it. `git` in general is a convenient tool when reading a codebase because it allows you to see how the codebase and to trace the sometimes obscure reasons behind certain changes.
4. An understanding of how the codebase works won’t emerge immediately. It certainly didn’t for me. Sometimes you have to read different parts of the codebase at different times to get a better sense of how the whole thing works.
5. GitHub’s search bar will get you far. A lot of folks will highlight using command line tools like `grep` to search through a codebase. I love tools like this, but I think GitHub’s command line interface is even more helpful. It has a robust enough search functionality and allows you to explore how code issues, pull requests, and source relate to each other.
6. Start to filter out or focus on patterns in the codebase. For example, when I was reading through the Node.js codebase, I found a lot of code at the beginning of function calls that related to parameter validation. After a couple of code reads, I became pretty aware of the different things that are checked when parameters are validated and began to filter out that type of code when I was reading new portions of the codebase.
7. Start with a small, well-defined question. A lot of open source codebases are significant (and, frankly, quite scary). Starting with a small and well-defined question (like “How does this standard library function work?”) has helped me maintain focus on particular parts of the codebase and to build my understanding over time.
8. Validate assumptions early and often. I often found myself making guesses about what certain parts of the codebase did. It was important for me not to let these guesses compound and spiral into an utter state of confusion. I made sure to always step back and try to validate (or invalidate) my guesses when I could.

I hope these tips were helpful! If you have more that you’d like to share, let me know [on Twitter](https://twitter.com/captainsafia).

