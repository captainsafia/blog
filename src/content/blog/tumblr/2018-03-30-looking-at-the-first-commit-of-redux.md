---
layout: post
title: Looking at the first commit of Redux
date: '2018-03-30T09:06:43-07:00'
tags: []
tumblr_url: https://blog.safia.rocks/post/172412300730/looking-at-the-first-commit-of-redux
---
My friend, [James Powell](https://twitter.com/dontusethiscode), recently texted me to recommend that I do some sort of “code archaeology” style code reads. In essence, I would check out a code base, go to the initial commit, then build up the story of the project by navigating through the commits on the project.

I was initially hesitant to go that route. I don’t consider myself much of a historian. Furthermore, the central reason for my doing these code reads was to answer questions that I had about particular projects (e.g., how does commit in Git work under the hood? or how does Node.js load modules?). But, I figured I might as well try something new and uncomfortable, so here goes.

I tried to figure out what the best approach to this would be. I could dive into the commit logs of a project and try to build a narrative around the changes that occurred, but to be honest, that’s not the kind of labor that I have the time for. I could look at the code that is associated with each tagged version of the project, but that’s no easier than the former situation. Finally, I settled on just looking at the first commit in a project. There’s a sense of nostalgia and romance associated with initial commits. I figured it would be quite fun to go back to the past and see where some of the popular open source projects in the industry started.

I wanted to do a project that was relatively new-is and that I had extensive experience using in production environments. I decided to do a code archaeology dig on the [redux](https://github.com/reactjs/redux) project. For those who are unfamiliar with state management in JavaScript, I’ll give a quick primer below, but the best place to learn more is the [Redux](https://redux.js.org) homepage.

Redux is referred to as a “predictable state container.” It allows you to create a central store for your web application where you can define both the state of the application and the actions that can be taken to manipulate that state. If this sounds weird right now, it’ll be clarified in later in the post. Also, the link to the Redux homepage provided above has some helpful resources written by people who are way better at explaining things than me.

Alright! Let’s get digging. I started by cloning the Redux codebase onto my local machine and checking out the earliest commit in the project.

    captainsafia@eniac ~/dev> git clone https://github.com/reactjs/redux.git && cd redux/
    Cloning into 'redux'...
    remote: Counting objects: 13825, done.
    remote: Compressing objects: 100% (34/34), done.
    remote: Total 13825 (delta 11), reused 9 (delta 5), pack-reused 13786
    Receiving objects: 100% (13825/13825), 5.87 MiB | 4.36 MiB/s, done.
    Resolving deltas: 100% (8743/8743), done.
    captainsafia@eniac ~/dev/redux> git rev-list HEAD | tail -n 1
    8bc14659780c044baac1432845fe1e4ca5123a8d
    captainsafia@eniac ~/dev/redux> git checkout 8bc14659780c044baac1432845fe1e4ca5123a8d
    Note: checking out '8bc14659780c044baac1432845fe1e4ca5123a8d'.
    
    ...
    
    HEAD is now at 8bc1465... Initial commit

Wow! The initial commit in the Redux code base. It’s rather cool that Git makes it so easy to travel back in time and see how something has evolved. Really gives you perspective, ya know?

I started by looking at the files that were staged under this commit.

    captainsafia@eniac ~/dev/redux> ls -1a
    .
    ..
    .babelrc
    .eslintrc
    .git
    .gitignore
    .jshintrc
    LICENSE
    README.md
    index.html
    package.json
    server.js
    src
    webpack.config.js

That’s way fewer files and folders than what’s in the code base now. This will definitely help with understanding the core concepts of Redux without getting caught up in the architecture that was added to the project as it evolved.

The first file that I wanted to look into was the [`src/redux/connect.js`](https://github.com/reactjs/redux/blob/8bc14659780c044baac1432845fe1e4ca5123a8d/src/redux/connect.js). The `connect` React component that is defined here is not actually part of the codebase that exists in Redux presently. Instead, it is a part of the `react-redux` library that provides components for connecting Redux to React. This wasn’t the case in the initial commit because at that point the Redux code base was very much so a work-in-progress proof of the Redux state container when coupled with React. As such, the `connect` component decorator manages attaching and detaching observers of the state to the component, handling changes to the state, and binding actions associated with the component.

The second file I wanted to look into was the [`src/redux/createDispatcher.js`](https://github.com/reactjs/redux/blob/8bc14659780c044baac1432845fe1e4ca5123a8d/src/redux/createDispatcher.js). This is, in my opinion, the most interesting portion of the code base to look into. For one, the dispatcher holds the responsibilities associated with dispatching actions (hence the name) and providing subscriptions on the state. The main function defined in this file, `createDispatcher`, has the following function declaration.

    export default function createDispatcher(stores, actionCreators, initialState)

The `initialState` is the default data tree that we want our state to be initialized with. An initial state is generally a JavaScript object, like the one below.

    {
      value: 10
    }

`actionCreators` are functions that return plain JavaScript objects, which represent actions in Redux. An action creator would look something like this.

    function decrement() {
      return { type: DECREMENT };
    }

Finally, `stores` link the two entities described above together. They describe how a specific action, like the DECREMENT action, should affect the information in the state.

The `createDispatcher` function returns the following function definitions.

    return {
      bindActions,
      observeStores,
      getState
    };

The [`getState` function](https://github.com/reactjs/redux/blob/8bc14659780c044baac1432845fe1e4ca5123a8d/src/redux/createDispatcher.js#L90) returns the current state of the application. There’s nothing really interesting going on there.

The [`observeStores` function](https://github.com/reactjs/redux/blob/8bc14659780c044baac1432845fe1e4ca5123a8d/src/redux/createDispatcher.js#L53) takes as parameters the portions of the tree that it should attach observers to (`pickStores`) and what it should do when a change is detected on that portion of the tree (`onChange`).

Finally, the [`bindActions` function](https://github.com/reactjs/redux/blob/8bc14659780c044baac1432845fe1e4ca5123a8d/src/redux/createDispatcher.js#L83) takes a collection of actions and associates them with a `dispatch` function that can actually compute how the state should change when a particular action is invoked.

From what I can tell, the `createDispatcher` file is really the heart of the initial commit. And it’s only 99 lines of code (with whitespace)! It establishes a lot of the core concepts in the Redux ecosystem (stores, actions, and states) and outlines their relationships with each other (when actions are dispatched they affect the state, the store is a holder for both actions and state, and so on).

The initial commit of the Redux codebase is heavily tied-in to the fact that it started off as a proof-of-concept for a state container for React applications (but has certainly evolved a bit past that). From my personal perspective, the initial commit looks less like the code for a popular JavaScript library and more like the code I might cook up to show a friend a concept or idea. It all goes to show that big things start from small places!

