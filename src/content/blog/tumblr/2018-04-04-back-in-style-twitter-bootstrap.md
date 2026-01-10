---
layout: post
title: 'Back in style: Twitter Bootstrap'
date: '2018-04-04T09:46:57-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172590275435/back-in-style-twitter-bootstrap
---
Another Wednesday, another blog post! I’m now entering the fourth month of consistently blogging three times a week. That’s a little over 36 blog posts in 3 months. Woohoo! I think at this point it officially counts as a habit?

In any case, I’m back with the series I’ve been doing looking into the first commits of popular open source projects. Today, I wanted to dive into one of the most starred projects on GitHub (and one I’ve frequently used in the past), [Bootstrap](http://getbootstrap.com). Bootstrap is a front-end library for building mobile-friendly and responsive web pages.

The project currently has over 17,000 commits, and I traveled all the way back to [commit #1](https://github.com/twbs/bootstrap/tree/eb81782cdbdc68aaebe4fa561b5fbb73ef866611).

    commit eb81782cdbdc68aaebe4fa561b5fbb73ef866611 (HEAD)
    Author: Mark Otto <markdotto@gmail.com>
    Date: Wed Apr 27 13:53:51 2011 -0700
    
        Porting over all Blueprint styles to new Baseline repo

Interesting. So it looks like the first commit was actually porting some code from an existing style library. After looking at the README associated with the initial commit, it looks like “Blueprint” was the name of the style library internal to Twitter before it was open sourced.

The original stylesheets were implemented using the [Less](http://lesscss.org) CSS language extension. I believe that recently, either in version 3 or version 4, Bootstrap migrated to the Sass language extension.

I was also drawn to the README of the initial commit which listed some TODOs that were pending on the project.

    Write "Using Twitter BP" section **Two ways to use: LESS.js or compiled** Not meant to be 100% bulletproof, but is 90% bulletproof (stats?) **Advanced framework for fast prototyping, internal app development, bootstraping new websites** Can be easily modified to provide more legacy support
    
    Add grid examples back in
    
    Cross browser checks? Show this anywhere?
    
    Add layouts section back in
    
    Point JS libraries to public library links instead of within the repo

I found this README very…I guess authentic is the best word for it. It feels very appropriate for the commit of a project being open sourced.

I decided to time travel a little bit more and see what the next couple of commits on the project were.

    $ git log --pretty=oneline
    0824ed4e3364bc0b49df89945dd69deff3ee7acd (HEAD) Updated docs styles for footer; updated readme;
    b95e99a173f50dbbca2478338f42165532289db7 Updated documentation; added stacked forms; cleaned up spacing; moved all ids to the section element instead of the page header to fix spacing with bookmarked links;
    b9d6acf766728b0bf28fe4d7644a80651f9b0e1c More documentation and content changes
    677b5554f34d8206b7424796448ee1b5a9ba0e87 Remove the unnecessary global.js file, remove the old baseline grid image, add in hashgrid, update readme to remove finished todos;
    eb81782cdbdc68aaebe4fa561b5fbb73ef866611 Porting over all Blueprint styles to new Baseline repo

As to be expected a lot of them are the type of commits that you would make if your company recently open sourced an internal project: adding documentation, examples, and cleaning up the repo. I appreciated the fact that these kinds of commits were made in public instead of before open sourcing it.

I decided to find out when the first official release of Bootstrap came out.

    git show --name-only v1.0.0
    tag v1.0.0
    Tagger: Jacob Thornton <jacobthornton@gmail.com>
    Date: Thu Aug 18 11:45:49 2011 -0700
    
    v1.0.0
    
    commit ae02a8a30049844a8bd2f81e74c622196b4a8d2a (tag: v1.0.0)
    Merge: bd1d38975 6d57f8a3d
    Author: Mark Otto <mark.otto@twitter.com>
    Date: Thu Aug 18 11:39:22 2011 -0700
    
        Merge branch 'master' of http://git.local.twitter.com/bootstrap
    
    README.md

As it turns out, everything between the initial commit and the initial release is associated with preparing the project for release.

That was a semi-interesting exploration. Admittedly, a lot of the commits and code pushed early on in the project were what I expected to come from a project in the process of being open sourced.

See you in the next blog post!

