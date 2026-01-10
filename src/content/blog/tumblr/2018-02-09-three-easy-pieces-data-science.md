---
layout: post
title: 'Three easy pieces: data science'
date: '2018-02-09T10:45:05-08:00'
tags:
- three-easy-pieces
tumblr_url: https://blog.safia.rocks/post/170687382655/three-easy-pieces-data-science
---
Three’s a magic number. Don’t you think?

_Good things come in threes._

_Three evil witches._

_Three wishes from a genie._

_Our three-dimensional existence._

One of those interesting coincidences. But the significance that the number 3 holds, in this case, is entirely different. I want to start a new thing on this blog called Three Easy Pieces. It’s a straight rip-off of the title of one of my [operating systems textbooks](http://pages.cs.wisc.edu/~remzi/OSTEP/), but you know what they say about [great artists](https://quoteinvestigator.com/2013/03/06/artists-steal/)…

The first topic that I would like to cover is one that I have been intrigued about since I first started tinkering with computers. It also happens to be one that has gathered quite a lot of attention in recent years.

Cryptocurrencies?

Nope.

Virtual reality?

Nah.

Self-driving cars?

Kind of.

If you know me and the tech industry well, you might have guessed it by now: data science!

Sans the hype and mathematical equations that you might see when discussing data science, the fundamental basis of data science is pretty fundamental: improve a machine’s ability to reason as well as a person does. Currently, computers have the edge over people because they are quite fast. Unfortunately, they are mostly not that clever. Unless explicitly told what to do, they can’t make reasonable decisions about how they should operate. Data science (and machine learning and artificial intelligence) are mostly attempts to get them to improve their reasoning ability. Can you imagine how awesome (and potentially dangerous) a machine that was both _fast and smart_ would be?

I figured that in this installment of Three Easy Pieces, I would focus on the three things I think should be the focal point when discussing data science and its role in society. Here they are.

**1. Good data**

Since data science is essentially pattern recognition, the machine needs to have enough data to recognize a vast array of patterns. As a person, you accumulate the data to build patterns in your brain through life experiences, structured education, practice, and so on. Machines are unfortunately not that flexible and need to be given the data in a cleaned and tabular format. You might have seen a headline or two about computers making poor decisions.

In fact, I’ve got a slightly funny story about this. A couple of years ago, a dating app had released a gimmicky machine learning-based app that gauged how “beautiful” people who find you. I uploaded my picture and got back the result: 30% of people would find me attractive. In a moment of vanity, I contested the results and began uploading of conventionally beautiful women to test the program. Kate Upton. Yes. Naomi Campbell. No. Heidi Klum. Yes. Tyra Banks. No. Kate Hudson. Yes. Beyonce. No. Seeing the pattern? After reading the technical blog post the company produced on the app, I realized the problem.

The data they were using to gauge how “beautiful” a woman was originated from how often she was “liked” on their platform. It turns out that a majority of the women on the platform where white women, and so the machine learned to give a lower attractiveness score to women of color.

This is a very gimmicky and comical example, but I’ll keep coming back to it in this blog post to show what it has to say about how data science can be inappropriately used. In this case, the app was primarily meant as a marketing ploy to get new users. The only thing hurt by my use of the app was my ego, but I eventually got over it. In a more serious application, the intents and harm could be far more severe.

So all in all, make sure that any data you give a machine to learn patterns from is clean, thorough, and varied.

**2. Good domain knowledge**

An oft-overlooked principle in a lot of data science and machine learning courses is that the development of a lot of machine learning models requires rigorous domain knowledge. Often, this domain knowledge doesn’t exist in the minds of people who have the technical and mathematical skills necessary to design machine learning models. One of the things that I’ve often seen in the early days of my career is the fact that data scientists are not very willing to engage and hear feedback from non-technical domain experts. Building an intelligent model for the hotel industry? Talk to hospitality staff. Developing an intelligent model in the fashion industry? Talk to designers or models or others involved in it.

I will clarify and say that I’ve seen this happen way more at data science teams within startups than I have seen it happen at data science consultancies or larger companies.

In the case of the app that I used, I doubt that they consulted a marketing or branding team before putting this out. Their goal was “attract people to our product,” but they build a promotional app that _disincentivized_ certain people, namely people of color, from using their product. If the technical individuals building it had taken the time to speak with a marketing team, they might have learned that this isn’t the best way to promote something. Or maybe they did talk with their marketing team and got the green light anyway, that hints at a more profound problem that can’t be consolidated into three easy pieces…

Regardless, it always helps to engage with the knowledge of domain experts when building tools that are designed to automate decision making in that domain.

**3. Good ethics**

This one gets a lot of attention, but also not enough. Mostly because of failures to follow #1 and #2, computers are taught to pick up incorrect patterns by the humans who are guiding them. Often, there is little effort to audit the behavior of automated computer algorithms or follow up appropriately on situations where computers

In the example above, the fundamentally ethical (and even philosophical) question to answer is whether or not to develop an application that gauges how “beautiful” someone is. Beauty is culturally subjective and the “global” definition of beauty that we have attempted to create post-globalization (and earlier than that during the early days of cross-cultural interactions: colonialism, exploration, etc.) has often been Euro-centric.

The ethics debate runs deeper in other implementations of machine learning: is it right to teach computers how to judge who will receive parole or not? Is it right to teach computers how to judge who will be given priority on housing lists?

Determining whether something is right or wrong is hard, but it’s essential that we actively engage with ethics to avoid the dystopian future where the machines kill us all. I kid. The reality is that a _real_ dystopian future with maligned intelligent machines will probably be one where the biases and unfairnesses that we have as humans are encoded into fast machines and have the confounding ability to hurt more and more people in subtle and vicious ways. In my mind, that future is way scarier than anything with a terminator or a replicant.

You might have noticed that the tips I gave up have nothing to do with the technical aspects of data science. I’m not recommending the best ways to tune parameters for specific models or the best model to apply for a particular type of model or any other kind of question that technical individuals in the data science often ask. That’s because I think that for this specific kind of problem, the non-technical issues around ethics and engaging across disciplines are much harder to answer than the technical ones.

So that’s it. My perspectives on data science in three easy pieces!

