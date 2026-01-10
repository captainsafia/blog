---
layout: post
title: Sliding into security with scrypt
date: '2018-04-11T09:34:19-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172827375280/sliding-into-security-with-scrypt
---
Earlier this week, I was trying to figure out how to export authentication data from Firebase to another database. As it turns out, Firebase provides a [command line utility](https://firebase.google.com/docs/cli/auth) that allows users to export authentication data from Firebase. As I was reading through the documentation for this tool, I came across a description of the hashing algorithm that Firebase uses to secure passwords: scrypt. I thought it would be interesting to dive into the codebase for this encryption technique. As it turns out, although it was invented in 2009, it has gained a resurgence of source recently due to its use in cryptocurrencies.

Usually, I would dive in straight to the code base and start reading the code for a particular open source project. However, I’ve never read the code for a cryptography related codebase. That being said, I figured that it is best I do some reading on how scrypt works so I know what to look out for when reading the codebase.

I started browsing through [the homepage](https://www.tarsnap.com/scrypt.html) to see what I could pick out. As I read through the webpage, I made a list of words that I didn’t completely understand and researched them further to determine some good definitions for them. It ended up only being two words. Here they are.

1. “key derivation function”
2. “hardware brute-force attacks”

I have a rough sense of what a “key derivation function” is based on the name. It’s a function that derives a secret key based on some internal algorithm. As it turns out, this is a pretty good definition of KDFs. I guess my imposter syndrome kicked in and I felt like I needed to know more here but I think this definition will suffice for now.

I know what a “brute-force attack” is, but what is a “hardware brute-force attack.” As it turns out, a “hardware brute-force attack” is essentially a brute-force attack that relies heavily on high-powered hardware, like GPUs for its functionality. GPUs are built with parallelism in mind, which means that GPUs can compute more in less time, which means they can execute brute-force attacks more effectively.

The next thing I wanted to look into the [original research paper](https://www.tarsnap.com/scrypt/scrypt.pdf) published alongside the release of scrypt. The paper is titled “Stronger Key Derivation via Sequential Memory-Hard Functions.” Ooooh boy. That’s a fun one. It’s not actually that bad in the scope of security research paper titles. The first thing I wanted to determine was what “memory-hard” meant. I had a pretty good idea, but I wanted to be sure. As it turns out, my hunch was correct. A memory-hard function is a function that utilizes an extensive amount of memory. They are used often in cryptography because in addition to something requiring a large amount of compute in order to be solved, having it require a large amount of memory will make it more resilient. The research paper linked above describes memory-hard functions with further detail.

> A memory-hard algorithm is thus an algorithm which asymptotically uses almost as many memory locations as it uses operations5; it can also be thought of as an algorithm which comes close to using the most memory possible for a given number of operations…

The research paper highlights the HEKS key derivation algorithm, which was designed to utilize arbitrarily large amounts of memory. IMO, the paper didn’t do a really good job of explaining the algorithm so I went and read more about it [at this webpage](http://world.std.com/~reinhold/HEKSproposal.html).

After scrolling through the research paper, I figured that it would be a good idea for me to write up a “plan of attack” for how I plan to read through the paper and what I’m hoping to get out of it. Specifically, I’d like to figure out.

1. The key parameters that the scrypt KDF relies on.
2. How the parameters affect the algorithms operations.
3. What the algorithm does with each parameter.

I’ll reread the research paper and do more research on the scrypt KDF to answer the questions above in the next blog post.

