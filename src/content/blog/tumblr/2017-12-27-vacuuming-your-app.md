---
layout: post
title: Vacuuming your app
date: '2017-12-27T09:53:00-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/169001297335/vacuuming-your-app
---
Earlier this month, I [posted a tweet](https://twitter.com/captainsafia/status/941090504757870598) about my methodology for improving an app once its base functionality has been implemented.

Before I continue the blog post, it helps to clarify what I mean by “base functionality.” Base functionality consists of the functions and algorithms that solve the applications core problem. In the case of Zarf, the “base functionality” involves authentication and user management, payment processing, payout scheduling, and content control access. This base functionality usually has a heavy server-side focus, meaning that a large chunk of the code powering them exists on the server and is usually not visible to the user.

I generally start building apps by building the core, server-side functionality with a temporary front-end layer on top. Once the server-side functionality has been completed, I shift my focus to the front end and focus on how I might be able to improve it.

I do the improvement process in multiple rounds. During each round, I’ll evaluate each page in the app and isolate the problems in that page that relate to a particular problem. For example, in one round, I’ll look through each page and determine if all the buttons have the proper default, hover, and active styles on them. In another round, I’ll look through each page and check that text elements have the proper line height. And so on and so on.

I find that this approach is particularly helpful for improving the user experience and design of an application’s front end without feeling overwhelmed by the enormity of the task.

Here’s an example list of the things I look for in each round of this process.

1. Check that all buttons have consistent styles in each page. This means that all buttons should have the same default color, hover color, positioning on the page relative to the form they are associated with, and so on.
2. Check that all paragraph components have the appropriate line height. This is particularly important for large pieces of text that you might find in the home page of an app.
3. Check the ratio of heading tags with the text they correspond with. This helps ensure that the proper ratios exist between font-sizes and that the user has a nice reading experience. You can read more about this aspect of typography in [this post from TypeCast](http://typecast.com/blog/a-more-modern-scale-for-web-typography).
4. Check that all forms inputs have the proper validations. This is largely to ensure that users provide accurate and easy-to-process data to your back end and have a pleasant experience using the product.
5. Check that all in-bound and out-bound links are healthy. This one seems pretty minor, but dead links make your product seem extremely unprofessional to users. Yikes!
6. Check that error pages surface correctly to the user. Usually, you want to avoid your users having to run into internal server errors but it helps to run the app to confirm that when the user does encounter them, they see a helpful and friendly error page.
7. Check the accessibility of images in the app. Ensure that they have descriptive alt-tags.
8. Run through each page in the app with a screen reader to ensure that it is accessible to those who utilize them.
9. Ensure that elements on the page with an on-click event are easily clickable. It should be obvious to the user that they can click on that element in order to access some additional functionality.
10. Check that each page renders the same (errr, roughly so because you know what they say about total cross-browser compatibility) in different browsers in the desktop.
11. Check that each page renders the same (ditto the caveat above) at different screen resolutions.
12. Check that each page renders responsively on mobile browsers.
13. Check that each page has the appropriate contrast between the text and the background by using a tool like the [ContrastChecker](https://webaim.org/resources/contrastchecker/).

I decided to playfully call this process “vacuuming an app” because it reminds me quite a bit of the process of vacuuming the same spot in a floor until it’s completely clean.

Do you have your own process for polishing up the front-end experience in your apps? Let me know [on Twitter](https://twitter.com/captainsafia).

