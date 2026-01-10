---
layout: post
title: Solving a problem then thinking too hard about how you solved the problem
date: '2018-01-31T10:03:06-08:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/170345949680/solving-a-problem-then-thinking-too-hard-about-how
---
Another Wednesday, another blog post!

Today, I’m gonna be working on a Project Euler problem. Gotta keep those problem-solving skills sharp! Know what I mean?

In my [last blog post](https://blog.safia.rocks/2018-01-24-problem-solving-with-safia-the/), I completed the 23rd challenge. So today, it’s time to work on the [24th problem](https://projecteuler.net/problem=24). The text for the problem is as follows.

> A permutation is an ordered arrangement of objects. For example, 3124 is one possible permutation of the digits 1, 2, 3 and 4. If all of the permutations are listed numerically or alphabetically, we call it lexicographic order. The lexicographic permutations of 0, 1 and 2 are:
> 
> 012 021 102 120 201 210
> 
> What is the millionth lexicographic permutation of the digits 0, 1, 2, 3, 4, 5, 6, 7, 8 and 9?

So as I mentioned in a previous post, my problem-solving strategy for these kinds of things (and many others) is just to implement the simplest thing that solves the problem. I’m not thinking about performance or elegance or whatever. I’m just getting it done! Anyway, in this situation, getting it done looks like this.

    import itertools
    digits = "0123456789"
    permutations = list(itertools.permutations(digits))
    print(permutations[999999])

So, what’s the answer to the challenge?!!?

    > ('2', '7', '8', '3', '9', '1', '5', '4', '6', '0')

As it turns out, this is the correct response!

There’s one more thing though. Although this solution runs pretty quickly and produces the correct output, it takes up a lot of space. So, here’s why. The `itertools.permutations` function returns an iterator. This is a Python object that computes and returns the values stored in it one by one. When I invoke `list` on that iterator, I’m asking it to invoke next repeatedly and save all the results in a list. This would make sense if I wanted to do some operation that involves storing all the permutations of digits but I don’t. So, a more time-efficient and space-efficient (and correct) implementation of the solution would be as follows.

    import itertools
    digits = "0123456789"
    permutations = itertools.permutations(digits)
    i = 0
    for permutation in permutations:
      if i == 999999:
        print(permutation)
        break
      i += 1

It’s a little bit more verbose. There are probably ways to reduce this verbosity, but I think what I have written here is fine. Let me know if you can come up with something less verbose but still easily understandable!

Side note: That’s always the caveat isn’t it. The “easily understandable” bit. It’s one of the big reasons I’ve long left my “clever code” phase.

Now, if it ended here, this would be a pretty boring blog post. But I wanna talk a little bit about that “simplest possible solution” that I provided above.

I started working on Project Euler problems when I was about 14 years old. I did 20-odd of them before I stopped. At that time, my solutions used a lot of fundamental programming concepts like iteration and list-building. Several years later, instead of going to those ideas as my go-to solution for some problems, I can better leverage the Python standard library to solve them.

I’m pretty proud of myself for that.

It probably seems subtle and not-that-big-a-deal but, to me, that transformation represents expertise and the accumulation of intellectual capital. I think a big part of being a good programmer (or being a good anyone-who-does-something) is continuously pushing what you can produce when you utilize the lowest effort. How good is the thing that you create when you invest very little intellectual energy on your behalf? How efficient can you become at utilizing brain power?

I’m not going to pretend to be the first person who’s had this revelation. If the Industrial Age represented humanity’s efforts to utilize and allocate mechanical energy efficiently, then the Information Age is a representation of our efforts to more efficiently use and allocate intellectual energy.

That being said, if I were to describe the things that contributed the most to my ability to allocate intellectual energy to solving technical problems more efficiently, it would be the following:

1. Prior knowledge. Standing on the shoulders of giants. Collective intelligence. You catch the drill.
2. Practice. Pattern recognition. More practice. Developing habits.
3. Foresight acquired by experience.

The first point has been recognized and attributed to by many a person throughout history. Our ability to push our knowledge forward is dependent on our ability to leverage the amount of knowledge that was produced by those who came before us. Whether you’re a software engineer using open source software or a mathematician utilizing an axiom proved by another person, the ability to look at the existing body of work in any field and leverage it appropriately has been extraordinary.

The second point has also been recognized. The more I do something, the better my brain gets at automating the “boring” parts of it. I’ll admit that for the most part, a lot of programming tasks are pretty dull for me. It’s not because I don’t enjoy programming, it’s because the amount of intellectual energy that I need to address a particular problem has been dramatically reduced.

The third point is one that I am still working on. I’m trying to get to a point where I can use my past experiences to develop an almost clairvoyant perception of future outcomes. I don’t have a solid recipe for doing this yet because it’s something that I’m still growing (and will probably continue to develop for the rest of my life), but I’m working on it.

So yeah, I think my own experiences with growing and learning to expand less intellectual energy on problems as a software programmer is part of a general trend that humanity is following. We are getting better at doing more with less. Pessimists might claim that this trend will push us to become lazy and disengaged with problems. Optimists might argue that this trend will drive us to take on bigger and bigger problems to challenge our intellectual abilities. I think the reality is probably somewhere in between.

Wow! This blog post took a sharp turn at some point, didn’t it? It’s just a showcase of how my mind thinks about things!

I promise the next one won’t have any tangents…

EDIT: Someone reached out to me via email with a solution implementation that is slightly more performant. Here’s a screencap of the solution and a brief explanation in my response of why it is.

![](https://cldup.com/mNcHKlGwRD.png)

