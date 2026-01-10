---
layout: post
title: How to (re-)launch a product
date: '2018-01-01T09:19:42-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/169186227660/how-to-re-launch-a-product
---
Tomorrow, I’ll be launching Zarf v2.0.

Zarf is (was?) a subscription content marketplace. Writers could register for accounts on Zarf and sell subscription or one-time access to their content. Zarf served as an alternative to ads for writers looking to generate revenue from their work. I’ve been independently developing, marketing, selling, and promoting a beta of the product over the past couple of months.

Over those months, I learned quite a bit about what worked for Zarf and what didn’t. All those learnings culminated in Zarf 2.0. Zarf 2.0 holds the same fundamental mission as Zarf: to give writers a space to host their high-quality exclusive content and to give their readers the chance to pay for it. However, the way I go about achieving that fundamental vision has changed. In this post, I wanna go through a rundown of some things I’ve learned and how I’m addressing them in the next release of Zarf.

**Knowing when to change**

I first wanna start off by saying that recognizing that Zarf 1.0 was not working as intended was the first step in actualizing Zarf 2.0. It was really hard for me to admit failure. Failure in this case being the fact that Zarf 1.0 didn’t acquire as many publishers and readers as I hoped it would. After I accepted that fact, I took the steps necessary to change the situation. I make it sound easy here but it certainly wasn’t. It was a slow realization that emerged over the course of three weeks. Have you ever had that moment where you realized something and you went “ooooohhhhhhh” but the first part of your “oooohhhhh” was less confident and more reluctant than the second one? That’s the best way to describe how I came to realize Zarf 1.0 was a failure.

Some of you might be rolling your eyes and thinking: “Safia, how could you possibly realize that the first iteration of the product was a failure only 2 months after launch?” The reality was that the sales process revealed a lot of shortcomings in the product that I hadn’t anticipating. The sales process is often times ahead of the engineering process when it comes to recognizing what customers need. I started my sales process after my engineering process (bad choice!) so I didn’t realize that I was building features that customers didn’t need until too late. Rookie mistake, but we all gotta make those.

**Subscriptions are out**

One of the big features that I had to remove in Zarf 2.0 was support for subscriptions. In Zarf 1.0, readers could subscribe to a writer’s publication for a fixed monthly fee and receive access to exclusive content. It was supposed to be the “golden feature” in the app, but the reality wasn’t as gilded. The subscription space is a crowded one. From Patreon to Medium to Memberful to Kickstarter: everyone is trying to make the subscription model work. It was hard for Zarf to compete in this space.

**Reducing the barrier to purchase**

The reality was, there was not a ton of content being purchased on the Zarf platform. No content purchased means no revenue. At the end of the day, I needed to keep the lights on at Tanmu Labs and for that to happen I need to have a consistent and healthy revenue stream and for that to happen I needed people to open their wallets a little when they browsed Zarf. To clarify, none of the ideas I’m implementing to incentivize users to purchase content on the platform employ “dark patterns.” There is no tracking of links, no ads, no promotions, and no unwanted emails. The barriers to purchase that I am removing are far more subtle and are generally designed to _improve_ the content purchasing experience. I started to look at ways that I could reduce the “barrier to purchase” on the Zarf platform. This included removing the requirement to register in order to purchase content on the platform and not requiring that users register in order to read their purchased content.

**It’s a marketplace**

One of the biggest confusions around Zarf was what it was. Was it a blogging platform? Was it a Patreon alternative? Was it a Medium competitor? Was it a marketplace? The product had so many directions that it was difficult to pinpoint just one. In Zarf v2.0, I’m focusing strongly on the marketplace direction and have made a few product decisions to guide it towards that. For example, users can no longer store drafts of posts on Zarf, they can only directly publish or delete existing posts. The idea here is to disincentivize using Zarf as a CMS and incentivize using it as a place to upload polished content. The assumption is that writers (especially those producing long form content), already have a place where they write and edit their work and need a place to upload polished drafts. Furthermore, I adopted a more e-commerce catalog look and feel for the posts browse page. In general, I’m making a more conscious decision to center the “marketplace” aspect in all parts of the product.

**Reducing the cost to run the platform**

In an exclusive post on Zarf 1.0, I gave a run-down of the monthly costs for keeping Zarf 1.0 running. The cost was much lower that it would be since I leverage quite a few student discounts through GitHub’s Student Pack but it was still not as low as it would’ve been. Zarf 2.0 is written and deployed on a completely different (and much cheaper) technology stack. There are so many SaaS and PaaS and DBaaS platforms out there that it is easy to get lost in the marketing lure of it all and invest capital in products that you don’t need. When I tabulated what I was paying for and what I was getting, I discovered that I wasn’t leveraging a majority of the features provided by the services I was utilizing.

**Focus on the words**

There’s admittedly a lot of platforms on the web where you can pay to support your favorite creators, but few that cater specifically to the written word. I figured that I should start taking advantage of this differentiation and center more product features around writing. The first thing I wanted to do was start a weekly “featured post” series where I would invite, curate, and promote indie publishers on the platform. I’ve also got another feature in the works that is designed specifically to help writers produce content that people are more likely to pay for but I’ll share more about that as it gets closer to release.

One of the key lessons for me in all of this is recognizing the fact that the first thing you build is not the best thing you build and that there are often multiple iterations that you need to go through before you produce something with product-market fit (and in my case, something you are proud of). Zarf is an ongoing journey for me and v2.0 is just another iteration of it.

