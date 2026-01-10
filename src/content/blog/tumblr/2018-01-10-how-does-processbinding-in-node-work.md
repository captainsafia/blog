---
layout: post
title: How does process.binding() in Node work?
date: '2018-01-10T09:05:54-08:00'
tags:
- node-deep-dive
tumblr_url: https://blog.safia.rocks/post/169543119660/how-does-processbinding-in-node-work
---
An alternative title for this post is: Going Down a V8 Wormhole. Wondering why? Read on!

So I’ve been doing these Node module deep-dives for a while now.

In [my last post](https://blog.safia.rocks/2018-01-08-node-module-deep-dive-fs/), I dove into the C-portions of the code base and briefly mentioned the `process.binding` and how it is used to expose internal modules (written in C) to Node. I’m curious about the details of how this works so I decided to dig into it.

I started by doing a Google search for “what is process.binding node” and figuring out what existing material there was on this. I found this [rather useful slide deck](http://lanceball.com/process-bindings) produced by [Lance Ball](http://lanceball.com). The interesting bits start right around [slide 12](http://lanceball.com/process-bindings/#/12) where it outlines that the “Node.js main function takes a process object.” I decided to go and find the code associated with this statement. The slides are about 3 years old at this point so I had to do some digging to find the actual lines of code mentioned. I tried my best but I couldn’t find the entry point where the Node process was initialized as referenced in that slide deck.

I wonder if over the past three years, the initialization has been moved to a non-JavaScript portion of the codebase. Perhaps the Node process and its dependencies are initialized completely via C++ extensions? I’m not sure. If you have any insights on this, let me know.

The [next slide](http://lanceball.com/process-bindings/#/13) discusses how the Process object is initialized in C++ and has some basic properties attached to it. Sure enough, I found the code [here](https://github.com/nodejs/node/blob/ececdd316766998ca3309ccb01f5618d44d0d91e/src/node.cc#L854-L863). It has changed a lot from the code that Lance references in his slides so let’s take a look at it.

    void SetupProcessObject(const FunctionCallbackInfo<value>& args) {
      Environment* env = Environment::GetCurrent(args);
    
      CHECK(args[0]->IsFunction());
    
      env->set_push_values_to_array_function(args[0].As<function>());
      env->process_object()->Delete(
          env->context(),
          FIXED_ONE_BYTE_STRING(env->isolate(), "_setupProcessObject")).FromJust();
    }

OK! So it looks like the `SetupProcessObject` function takes a callback as an argument and configures the “Environment” passed on this. The first thing I wanted to do was figure out what exactly `Environment::GetCurrent(args)` did. This function call is used quite a lot in this file and I think it’d be neat to figure out what it does exactly. I tried to examine the headers of the `node.cc` file to see if it made any references to some sort of `env` or `environment` file. Sure enough, there was a reference to an `env-inl.h` header file, so I went looking for that and found it [here](https://github.com/nodejs/node/blob/ececdd316766998ca3309ccb01f5618d44d0d91e/src/env-inl.h). It had several `GetCurrent` functions defined, each taking a different kind of parameter. I tried to find the `GetCurrent` function that took a `FunctionCallbackInfo<value>` parameter similar to the one that was passed to it in the code snippet above and found the following.

    inline Environment* Environment::GetCurrent(
        const v8::FunctionCallbackInfo<:value>& info) {
      CHECK(info.Data()->IsExternal());
      return static_cast<environment>(info.Data().As<:external>()->Value());
    }

So it looks like what this function is doing is extracting some data from the `info` object using the `Data()` function and returning its value as a `v8:External` data type. I’ve never seen the `static_cast` operator before, so I did some looking into it and [discovered](https://en.wikipedia.org/wiki/Static_cast) that it was responsible for doing explicit type conversions. This confirms my hypothesis that this function is essentially responsible for extracting details about the current environment Node is running in from the `FunctionCallbackInfo` object and returning it as an `Environment` type. Anyhoooowww, I’m not too interested in what is going on with all of this `Environment` stuff at the moment. What I am particularly curious about is this next line here.

      env->process_object()->Delete(
          env->context(),
          FIXED_ONE_BYTE_STRING(env->isolate(), "_setupProcessObject")).FromJust();
    }

OK! So it seems like this line extracts the “process\_object” from the environment and `Delete`s something in it. I looked around the codebase and discovered that the `process_object()` function returns a `Local<object>` typed object. From some snooping around, I discovered that this `Local<object>` is a type defined within the V8 library, the JavaScript engine. From looking at [some documentation](https://v8docs.nodesource.com/node-0.8/db/d85/classv8_1_1_object.html), I discovered that `Local<object>` was the object that other objects in V8 (like Date objects and Number objects) inherit from.

The next thing I wanted to figure out what was what `env->context()` was. From some snooping on some header files in the code base, I discovered that it was a `v8:Context` object. I read some more [documentation](http://bespin.cz/~ondras/html/classv8_1_1Context.html) and discovered that the Context object seemed to be used by Node to maintain basic configuration details about the currently running process, like what extensions are installed on it.

The next part of the code that was interesting was this little fella right here.

    FIXED_ONE_BYTE_STRING(env->isolate(), "_setupProcessObject")

Ummm. wut. The first thing that I wanted to figure out what was what exactly `FIXED_ONE_BYTE_STRING` did. My suspicion, given the name, was that it generates a fixed length string from the parameters given. The second parameter is obviously a string so there isn’t much digging to do there but I was curious about the first, the `env->isolate()`. After I read some more code in different parts of the code base, I discovered that `env->isolate()` probably represented a V8:Isolate object, which you can read more about [here](https://v8docs.nodesource.com/node-0.8/d5/dda/classv8_1_1_isolate.html).

Alright, I went through a lot of wormholes there and didn’t really find what I needed to know (do we ever really find what we need to know?). I’m gonna do some more reading and get a better sense of what the exploratory roadmap for understanding the bridge between Node and V8 is. The good thing now is I feel a little bit more comfortable exploring the bridge between V8 and Node. For me, it’s a shaky and nerve-wracking one but I’m slowly starting to figure it out. Onwards!

If you know more about V8’s source and would like to clarify anything I mentioned above, [let me know](https://twitter.com/captainsafia).

