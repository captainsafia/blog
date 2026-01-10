---
layout: post
title: How To Create A Welcoming and Inclusive Open Source Space
date: '2016-03-30T15:28:01-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/141972488250/how-to-create-a-welcoming-and-inclusive-open
---
Originally published on [OpenSource.com](https://opensource.com/life/16/3/creating-welcoming-and-inclusive-open-source-space).

In [a 2013 survey](http://floss2013.libresoft.es/results.en.html), 11% of contributors to free and open source software identified as women. But perhaps the future looks brighter? We can answer this question by examining the participation of women in [Google Summer of Code](https://developers.google.com/open-source/gsoc/), a program that provides a stipend for post-secondary school students to contribute to open source software for a summer. From [2011](http://google-opensource.blogspot.com/2012/05/google-summer-of-code-2012-by-numbers.html) to [2015](http://google-opensource.blogspot.cz/2014/06/google-summer-of-code-2014-by-numbers.html), the program consisted of about 7-10% female participants. This is an extremely low percentage and does not bode well for the future of diversity in open source.

More recently, a [study on gender bias in open source](https://doi.org/10.7287/peerj.preprints.1733v1) was published through a joint effort between North Carolina State University and the California Polytechnical Institute at San Luis Obispo. Although the study has been widely distributed and analyzed by several media outlets, I will caveat my own analysis with the statement that the study has yet to undergo peer review. Furthermore, the findings in the study only apply to about 35% of the GitHub user base, which is not representative of the entire open source community by any respects. That being said, the study does conclude that for this particular subset of users, women do tend to have their pull requests accepted more frequently than men. What does this mean? We can conclude that although women don’t make up the majority of open source contributors, their contributions are valued at an equal or greater extent to those of men.

It appears that women are more-than-capable developers but make up a small portion of the open source community. As it appears, the participation of women in open source doesn’t look like it’s going to increase. How can we change this? By enforcing codes of conduct, effectively moderating communications on pull requests and issues, creating a healthy and welcoming environment for new contributors, building non-digital spaces, and practicing empathy, open source projects can create communities that are diverse and inclusive.

### Codes of conduct

A code of conduct is an important part of any open source software project. If you are a corporation looking to take an internal project public, be sure you have a code of conduct in place before doing so. If you are a solo developer getting ready to push the first public commit of a personal project, be sure you have a code of conduct in place before doing so. There should be no hesitation or question about whether or not a code of conduct should be included in a codebase. We have codes of conduct governing our states, our countries, and our global society, so why wouldn’t we have codes of conduct present in our software? Codes of conduct solidify the expectations and objectives of a project. Believe it or not, although you might have expectations about what kind of behavior is and isn’t acceptable in the community around a project, some people do not. Codes of conduct help set a baseline for the global dialogue around behavior in the digital world.

There are plenty of codes of conduct that you can use as part of your project. I personally recommend using the [Contributor Covenant](http://contributor-covenant.org/). The language of the document is simple, concise, easy to understand, and already contains several translations. Furthermore, it is currently used by quite reputable open source projects such as [Atom](https://atom.io/) and [Ruby on Rails](http://rubyonrails.org/).

### Dialogue on PRs and issues

Pull requests and issues can be some of the most tense environments in an open source community, and rightly so. In them, people expose their hastily written code and half-baked feature requests in addition to their well-written code and bug-reports. The exposed nature of pull requests and issues leaves new and old contributors alike nervous about their place in the project. Thus, it’s important to maintain a civil, empathetic, and respectful tone when communicating with other developers in an online space. This might seem like not much to ask, but you’d be surprised how much damage can be done with an emotional mindset and a readily accessible Enter key.

Tone is difficult to discern in a digital space, and we often end up applying our current emotions and context to the things we read online. If you feel immediately annoyed or insulted by a request or a comment, read it again at another time. If you still feel ambivalent about the tone of the comment, ask for clarification. Never—and I repeat, never—apply a tone or intent to another person’s comment that is fueled by your personal state of mind. This simple misunderstanding starts a lot of miscommunications and problems, and can be easily avoided by giving the person that you are communicating with the benefit of the doubt.

That being said, disagreements do happen quite often. When they do get heated or emotional, it’s important for project maintainers to uphold the following rules in each discussions:

Critique the ideas, not the ideator or his/her abilities. Include an unbiased moderator in all highly opinionated discussions. Enforce the project’s code of conduct appropriately. You’ll notice that I didn’t mention anything about marginalized individuals in this section. This is because negative interactions on pull requests and issues affect all contributors negatively, but contributors from marginalized backgrounds even more so. When you have to be constantly vigilant about how your tone and ideas are presented in a space, someone receiving your harmless remark or less-than-perfect pull request in a negative manner can have detrimental effects.

### The value of new contributors

New contributors are the lifeblood of any open source project. While some people might be tempted to exalt core developers and maintainers, it’s actually new contributors that maintain the spirit of the project.

New contributors prevent an open source development team from becoming cliquey. New contributors introduce interesting new ideas to a project. New contributors present ideas that are opposite the status quo. As a result, effective engagement with new contributors should be at the forefront of any open source project.

After writing open source software for several years, you might have forgotten what it feels like to fork a repository for the first time, to nervously tap away at your keyboard writing code that you think is bad, to hover for hours over the Pull Request button wondering how your contribution will be received. Being a new contributor is an emotionally and mentally exhausting process, but there are ways to make it less so for new contributors.

First and foremost, ensuring that you have [nicely written contribution guidelines](http://pandas.pydata.org/pandas-docs/stable/contributing.html) is important. Whether it’s a simple Markdown or plain text file, ensure that your guidelines contain complete information on a development setup, the test-driven development process, any style guidelines you use, and any procedures you have around submitting pull requests. Don’t be afraid to reproduce information that exists elsewhere. It’s perfectly reasonable to provide information about forking and cloning, creating branches, and committing changes. Although it puts a lot of overhead on you as the writer of the guidelines, it provides the new contributor a single, authoritative source for getting involved with a project.

In addition to including thorough contribution guidelines, consider including a screencast that visually takes new contributors through the contribution workflow. If a screencast is too much effort, consider making a quick infographic that describes the workflow. For an example, check out the [contribution workflow infographic](http://jupyter.readthedocs.org/en/latest/_images/contribution_workflow.png) I made for [Project Jupyter](http://jupyter.org/). Different people learn in different ways and providing different ways for new contributors to learn about getting involved with your project lets them know that you are aware and mindful of their unique perspective.

However, before new contributors can even begin to engage with a project, they have to know what they can do. Tagging issues in a project with information about the type of contribution required to complete the issue (documentation, test case, feature, bug fix, etc.), the difficulty of a particular issue (low, medium, high), and the priority level can go a long way toward helping new contributors find the perfect issue for their first pull request. Tagging the type and priority of an issue can relatively easy, but tagging the difficulty does require a bit more nuance. When tagging the difficulty of an issue, I think it is important to consider the following questions:

- Does addressing this issue require changes across multiple files?
- Does addressing this issue require special knowledge of a particular topic (threading, low-level network communication, etc.)?
- Does addressing this issue involve interacting with an undocumented or untested portion of the codebase?

Answering these questions not only helps you provide more information to new contributors, it helps you assess the quality of your own codebase and work toward improvements.

### The importance of non-digital spaces

In addition to digital forums, it’s also important to have opportunities to form real-world connections around an open source project. These connections don’t have to happen at a conference or a meetup organized around the project—they can happen anywhere. There is a certain level of respect and camaraderie that can be achieved when individuals engage with each other in the real world. Members of the community can host pop-up events at local coffee shops or co-working spaces that include collaborative coding, casual conversation, and knowledge sharing. Whether we like it or not, people have different digital and real-world personas, and allowing a community to develop around your project outside the Internet gives potential contributors with strong social skills the opportunity to engage with the project.

### Enhancing empathy

In an increasingly connected world, writing software with people across the country, and indeed across the world, is expected in a work environment. The worldwide interactions are even more common in open source, where anyone with access to the Internet and a text editor can learn about and contribute to open source project. This is bound to cause a lot of tensions as we attempt to engage in technical and non-technical discourse with people from countries we might not even be able to identify on the map. How do we effectively traverse the multicultural ecosystem of open source software? It involves something that you’ve probably heard time and time again but might have trouble getting a full grasp of: engineering empathy. I believe that empathy is a muscle that you can strengthen. Namely, the following behaviors can go a long way towards improving your empathetic skills:

- Read technical blog posts written by developers from different cultures.
- Watch technical talks from conferences held in countries different from the one you reside in.
- If you have some fluency in another language, try reading the news in that language. This will give you perspective into what it feels like to be a non-native English speaker in open source.

These techniques will help you discover how developers from different backgrounds think, write, speak, and share. Over time, you’ll develop a sense of perspective and appreciation for the way that different people approach software development.

### Final thoughts

You’ll notice that the above tips I described don’t specifically target marginalized individuals. When you create a space that is welcoming and receptive of marginalized individuals, you create a space that is welcoming and receptive of everyone.

