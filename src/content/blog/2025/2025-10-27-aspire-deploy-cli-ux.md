---
title: "How I used AI to redesign Aspire's deploy CLI command"
description: "How I used Claude and Copilot to design the Aspire deploy CLI, moving from sequential steps to a concurrent-ready design that works in both interactive and CI/CD environments."
tags: [aspire, cli, ux, design, ai-tools]
---

A few weeks ago, I posted on Bluesky [soliciting feedback for a new user interface](https://bsky.app/profile/captainsafia.com/post/3lz7tvw67rk2g) I was proposing for the `aspire deploy` command. That UI has now landed in the Aspire CLI previews and will be available in the general release of Aspire 13. I wanted to spend some time writing about how I arrived at the new UX and how it evolved after the initial change was merged.

## Background and Constraints

First, some background. The Aspire CLI talks to the Aspire application host over an RPC channel. The host executes the core deployment pipeline logic but transmits status messages to the CLI over this channel as needed. The ActivityReporter API on the host side sends these updates to be displayed in the CLI. Currently, the API structures updates as a hierarchy of steps and tasks.

In the [issue for this redesign](https://github.com/dotnet/aspire/issues/11524), I outlined some key limitations of this hierarchy. The current ActivityReporter API and steps/tasks UI have constraints that make the API difficult to use for custom deployment scenarios and hard to scale as we work towards modeling deployment steps in a pipeline. The notable constraints are:

- **Steps are always sequential.** There's no way to run multiple steps concurrently. This is a problem when we eventually want to support processing arbitrary steps in a pipeline, some of which might happen concurrently.
- **Poor non-interactive support.** The Tasks API used in Spectre for interactive progress components doesn't scale well to non-interactive UIs (like CI/CD pipelines), making it hard to capture meaningful logs.
- **Limited logging options.** There are limited ways to show logs from tasks outside of the gray ghost text on tasks.

Here's how the UI looked like as of Aspire 9.5:

![A gif of the deploy CLI in Aspire 9.5](/assets/images/2025-10-27-aspire-95-cli-ui.gif)

We wanted to refactor the API and UI to optimize for concurrent steps and non-interactive rendering. On the UI side, we needed something that visualizes executing steps as a continuous, sequential stream while still:

- Showing parent-child relationships between steps and tasks
- Allowing multiple steps/tasks to be interleaved among each other
- Making it obvious that deployment is in progress even when there are no active steps
- Working well for steps with no tasks beneath them (like the Azure CLI authentication check)

Finally, it was critical that this UI worked well in both interactive scenarios (like a developer's local CLI) and non-interactive scenarios (like a CI/CD runner).

## The Design and Implementation Process

With these requirements in mind, I started brainstorming. I jumped into Claude to research existing CLI UIs that matched what we needed for representing deployment pipelines. My prompt consisted of:

- The UI requirements outlined above
- An example of the current CLI output showcasing the steps and tasks that needed to be displayed

Here's a screen-capture of that session in Claude:

![UI brainstorming session with Claude](/assets/images/2025-10-27-claude-cli-ui-session.png)

I went back and forth with Claude on the design, prompting it to include sample outputs in different formats based on the example data I provided. This gave me a nice visual gut-check of the different options. When it landed on something I liked, I grabbed a snippet of the output and jumped into Copilot in VS Code. I asked it to translate the output into a sample implementation using the Spectre CLI package (the same one that Aspire uses for output rendering). This let me translate Claude's static output into something more dynamic. That's how I arrived at the following initial UI:

![A gif of the initial prototype of the new Aspire CLI](/assets/images/2025-10-27-ui-prototype.gif)

I did some low-key customer research and showed it to two fellow Aspire team members to get their gut reactions. From there, I made a few tweaks to spacing and styling. At this point, as usually happens, I got sidetracked by something else but knew I'd eventually get back to this proposal.

I did this initial research towards the tail end of Aspire 9.5, knowing I wanted the new UI to land in the next version. Release time is always busy with dogfooding and doc writing, so I circled back and implemented the first cut of the CLI in Aspire in [this PR](https://github.com/dotnet/aspire/pull/11780). A few more changes went in after the initial merge, including:

- Using an arrow emoji to indicate when a new step is executing
- Using a checkmark emoji instead of green colored text to indicate when a step completed successfully
- Displaying a step summary status at the end
- Supporting Markdown rendering in the step tasks
- Clean ups to the way text parameters from the API were displayed in the UI

And with that, we arrived at the final UI shipping in Aspire 13. Voilà!

![A gif screencap of the final UI for the Aspire deploy CLI](/assets/images/2025-10-27-new-ui-final.gif)

## Reflections

I'm really excited about how this new UI turned out! It strikes a nice balance between being informative for developers who want to understand what's happening during deployment and being clean enough to work well in CI/CD environments. It also achieved the major goal of making the ActivityReporter API much easier to work with.

The process of using AI tools like Claude for brainstorming and Copilot for implementation really sped up the design iteration cycle. Once the design was complete and the changes were in Aspire's development branches, we leveraged the Copilot agent to add follow-on enhancements. Those came from the practical reality of using the tool and the different perspectives that team members brought to the initial design.

---

P.S. The GIF screencaptures that you see here were generated with [castgif](https://github.com/captainsafia/dotfiles/blob/943e08da3855475887983f2824592d097e46ea77/fish/functions/castgif.fish), a Fish function that wraps asciinema to automatically record and generate gifs from terminal sessions. I wrote this utility with the help of Copilot as well.

P.P.S. The deployment space in Aspire is moving fast and some of the concepts mention here are already out-of-date. For example, the notion of "deploy" being a special noun is being replace by an even more interesting verb. More on that in a future post!
