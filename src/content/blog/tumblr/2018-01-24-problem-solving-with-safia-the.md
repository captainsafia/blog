---
layout: post
title: 'Problem solving with Safia: the optimizer’s dilemma'
date: '2018-01-24T10:11:51-08:00'
tags:
- problem-solving-with-safia
tumblr_url: https://blog.safia.rocks/post/170079229115/problem-solving-with-safia-the
---
I have a confession to make.

I’m getting pretty bored of reading the Node codebase.

I know, I know. I’ve only been doing it for about three weeks now, but what can I say? I’ve got a rather short attention span. Maybe I’ll get back to it at some point, but for now, I’d like to try some different things.

I was recently reminiscing about some of the things I liked doing when I first started coding in my teens. As it turns out, I liked solving some of the problems on [Project Euler](https://projecteuler.net). In fact, I kept a little blog where I maintained the solutions for the problems that I was solving. I will avoid linking to that blog here because some things just need to die in obscurity.

Anyway, I figured that I would pick up where I left off and start solving some of the problems here and live-blogging my solutions as I write them.

It turns out that the last problem that I solved (or at least publicly blogged about the solution for) was [problem 22](https://projecteuler.net/problem=22) back in September of 2012. That would’ve been the start of my sophomore year in high school. Feels like centuries ago!

So with that in mind, I figured that I would start, six years later, by working on the solution for [problem 23](https://projecteuler.net/problem=22). It goes a little something like this.

> A perfect number is a number for which the sum of its proper divisors is exactly equal to the number. For example, the sum of the proper divisors of 28 would be 1 + 2 + 4 + 7 + 14 = 28, which means that 28 is a perfect number.
> 
> A number n is called deficient if the sum of its proper divisors is less than n and it is called abundant if this sum exceeds n.
> 
> As 12 is the smallest abundant number, 1 + 2 + 3 + 4 + 6 = 16, the smallest number that can be written as the sum of two abundant numbers is 24. By mathematical analysis, it can be shown that all integers greater than 28123 can be written as the sum of two abundant numbers. However, this upper limit cannot be reduced any further by analysis even though it is known that the greatest number that cannot be expressed as the sum of two abundant numbers is less than this limit.
> 
> Find the sum of all the positive integers which cannot be written as the sum of two abundant numbers.

Alright! So the main goal here is to find the sum of all positive integers that cannot be written as the sum of two abundant numbers. The problem text also tells us that every number greater that 28,123 _can_ be writtern as the sum of two abundant numbers. So this narrows down our search space to numbers between 0 and 28,123. That’s a pretty large search space, although we have these things called computers that are stupid and fast and we can put them to work!

I’ll admit that I used to be the kind of programmer who would sit and look at problems like these and try to cook up a clever solution right away. But I got older (and wiser) and realized that in most cases, you’d be totally find just throwing a for-loop at the problem. So I created a quick little template for what the solution would look like.

    def abundant_terms_for_sum(x):
        fancy math stuff that I'm unsure of yet
    
    def non_abundant_sums():
      total = 0
      for x in range(28123):
          if not abundant_terms_for_sum(x): total += x
      return total

Pretty basic, right?

Side note: I’ll be using Python 3 to solve these problems. That’s the same programming language I used to solve them when I was a teenager. Although looking back at my blog, I solved some of them using Common Lisp. Maybe I’ll take a crack at doing that now!

Now, since I first started solving these problems in my sophomore year of high school, I’ve had about 6 years of advanced algebra and calculus classes taught to me. That being said, I still have no clue what I’m doing when it comes to math. So I headed over to the good ol’ trusty Google dot com to see if someone who liked numbers way more than me had figured out a clever way to determine whether a number could not be the sum of two abundant numbers.

Side note: If you can’t be clever yourself, you can always leverage another person’s cleverness!

I couldn’t find anything useful on the Internet, so it turns out I’ll have to use my own noggin for this one. I suppose the point of these problems is to put the noggin to work anyways…

So, my general strategy for things like this is to create an outline of the program with a scaffold of all the functions that I think I might need to call.

    def generate_abundant_numbers():
        create a list of the abundant numbers less than 28123
    
    ABUNDANT_NUMBERS = generate_abundant_numbers()
    
    def abundant_terms_for_sum(x):
        for num in ABUNDANT_NUMBERS:
            difference = x - num
            if difference in ABUNDANT_NUMBERS:
                return True
        return False
    
    def non_abundant_sums():
      total = 0
      for x in range(28123):
          if not abundant_terms_for_sum(x): total += x
      return total

So basically, my plan is to generate a list of all the abundant numbers that are less than the boundary we set at 28,123 in a global called `ABUNDANT_NUMBERS`. Then, the `abundant_terms_for_sum` function will check if the terms of the sum of `x` are in `ABUNDANT_NUMBERS` and handle it appropirately. The only unfilled function here is the `generate_abundant_numbers` function. I did some hacking around to figure out if I could implement something using for-loops and mathy-math and came up with the following.

    def get_proper_divisors(n):
      divisors = []
      for x in range(1, n + 1):
        if n % x == 0 and n != x: divisors.append(x)
      return divisors
    
    def generate_abundant_numbers():
      numbers = []
      for x in range(28123):
        proper_divisors = get_proper_divisors(x)
        if sum(proper_divisors) > x:
          numbers.append(x)
      return numbers

Now, this piece of code took so long to run, I had to trim my hair by the time it was done running. Well not really, I actually ended up just halting it as it was checking the 93rd number but you get the gist.

The big culprit here is the fact that there are **two** iterations that go from 0 to 28123 so the time complexity (oh gosh, did I just use those words?!!?) of this particular implementation is `O(n^2)`.

If this was a technical interview, this is the point where I would stare blankly at the screen and babble out my stream of concious to the poor person on the other end of the phone. Since I’m just doing this alone in my bedroom, I’m going to stare really hard at the code until some revelation hits me through some form of air-based diffusion.

Just stare really hard.

Keep staring.

And thinking.

So there are a few things that I can do here. The problem statement that 12 is the smallest abundant number. So I updated my code to refelct this.

    def generate_abundant_numbers():
      numbers = []
      for x in range(12, 28123):

The next thing I realized was a problem with my `abundant_terms_for_sum` function. When iterating through each of the `ABUNDANT_NUMBERS` I needed to do a better job of skipping throug the abundant numbers I knew for sure were not part of the solution.

    def abundant_terms_for_sum(x):
        for num in ABUNDANT_NUMBERS:
          if num > x: return False
          difference = x - num
          if difference in ABUNDANT_NUMBERS:
            return True
        return False

With these changes, I noticed that the program was running much, much faster. I hadn’t actually done anything to alter the time complexity of the implementation, but the minor changes I made helped improve the run-time for the average case that I was dealing with.

At this point, I actually decided to let the program run all the way through. I still hadn’t actually verified that my implementation was correct, so it was kind of silly for me to be working on optimizing something that might not have been totally accurate.

So I let this rather slow code run for a little bit while I went out and pretended that I wasn’t really a robo — errr, while I cleaned up my apartment.

Once it was done running, I pasted the answer I got into the checker and found out I was correct. What a relief! Now I can do some more optimizations without

The next thing I did was make some improvements to the way that `proper_divisors` and `generate_abundant_numbers` worked. Overall, these changes reduce the space complexity of the program since I’m directly computing the sum of the proper divisors instead of storing the divisors in an array and then summing them up. This helped a little bit because as it turns out the time complexity of the `sum` function in Python is `O(n)`.

    def get_proper_divisors(n):
      total = 0
      for x in range(1, n + 1):
        if n % x == 0 and n != x: total += x
      return total
    
    def generate_abundant_numbers():
      numbers = []
      for x in range(12, 28123):
        sum_proper_divisors = get_proper_divisors(x)
        if sum_proper_divisors > x:
          numbers.append(x)
      return numbers

Side note: I know I’m using the words time complexity a lot and it might be scary if you are a new programmer. You can read more about what time complexity is [here](http://podbay.fm/show/1304168963/e/1511913661?autostart=1) or [here](https://rob-bell.net/2009/06/a-beginners-guide-to-big-o-notation/) but basically it is just a fancy way of answering the question “How long will this program take to run?”

The next thing I did was refactor the `non_abundant_sums` function to take advantage of list comprehensions.

    def non_abundant_sums():
      return sum([x for x in range(28123) if not abundant_terms_for_sum(x)])

So, my current solution thus far looks like this.

    def get_proper_divisors(n):
      total = 0
      for x in range(1, n + 1):
        if n % x == 0 and n != x: total += x
      return total
    
    def generate_abundant_numbers():
      numbers = []
      for x in range(12, 28123):
        sum_proper_divisors = get_proper_divisors(x)
        if sum_proper_divisors > x:
          numbers.append(x)
      return numbers
    
    ABUNDANT_NUMBERS = generate_abundant_numbers()
    
    def abundant_terms_for_sum(x):
        for num in ABUNDANT_NUMBERS:
          if num > x: return False
          difference = x - num
          if difference in ABUNDANT_NUMBERS:
            return True
        return False
    
    def non_abundant_sums():
      return sum([x for x in range(28123) if not abundant_terms_for_sum(x)])
    
    print(non_abundant_sums())

To be honest, it is still pretty hecking slow.

First and formost, the `get_proper_divisors` function takes a really long time to run. I optimized it using a pretty common optimization for factorization algorithm that relies on [one of the properties](https://stackoverflow.com/questions/5811151/why-do-we-check-up-to-the-square-root-of-a-prime-number-to-determine-if-it-is-pr) of the factors of a number.

    def get_proper_divisors(n):
      limit = math.sqrt(n)
      if limit.is_integer(): total = -limit
      else: total = 1
      for x in range(2, int(limit) + 1):
        if n % x == 0: 
          total += x + int(n / x)
      return total

The next thing I did was remove the reliance on `abundant_terms_for_sum` and just use Python’s `any` function to check if there were any abundant terms that added up to a particular sum.

    def non_abundant_sums():
      total = 0
      for x in range(28123):
        if not any((x - i in ABUNDANT_NUMBERS) for i in ABUNDANT_NUMBERS): total += x
      return total

Despite these changes, the program was still running a bit slow. Specifically, there were two for-loops in the code that iterated up to 28,123, the one in `non_abundant_sums` and the one in `generate_abundant_numbers`. I decided to combine these two functions together and avoid pre-allocating the dependent numbers. I also ended up using a `set` to store the date because I realized that we don’t care much to have duplicate summation entries in our data set.

    def non_abundant_sums():
      total = 0
      numbers = set()
      for x in range(28123):
        if get_proper_divisors(x) > x:
          numbers.add(x)
        if not any((x - i in numbers) for i in numbers):
          total += x
      return total

Sweet! Now the program runs a little faster. Here’s the final code for the curious.

    import math
    
    def get_proper_divisors(n):
      limit = math.sqrt(n)
      if limit.is_integer(): total = -limit
      else: total = 1
      for x in range(2, int(limit) + 1):
        if n % x == 0: 
          total += x + int(n / x)
      return total
    
    def non_abundant_sums():
      total = 0
      numbers = set()
      for x in range(28123):
        if get_proper_divisors(x) > x:
            numbers.add(x)
        if not any((x - i in numbers) for i in numbers):
          total += x
      return total
    
    print(non_abundant_sums())

So basically, I started off writing a lot of very simple code then I shaved a ton of it off. This is usually how things go for me when I’m solving problems. Just dump whatever I can onto the screen and then see if I can make it better!

There’s a big life lesson in there somewhere….

