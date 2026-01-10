---
title: "Design flashpoint: `aspire publish` vs `aspire deploy`"
description: "Exploring the design decisions behind aspire publish and aspire deploy commands, and how they balance between ejecting from the Aspire ecosystem versus providing fine-grained deployment control."
tags: [aspire, deployment, .net, api-design]
---

From my blog posts and pull requests, you might've gleaned that I've been doing a ton of work building out the experience for deploying Aspire applications to various targets. Today's blog post is a rehash of some discussions the team has been having about the behavior of the `aspire publish` and `aspire deploy` commands.

## Background on the publish and deploy commands

First, some background on these two commands. The `aspire publish` command is a carry-over from the `dotnet run --publisher manifest` experience that Aspire had, which would output a manifest representing a serialized definition of the services and resources modeled in your application host. This evolved into a dedicated `publish` command in the Aspire CLI and APIs within the Aspire framework that allow you to define custom behavior invoked during publish.

Out of this, we get an ecosystem of publishers that emit different assets:

- Docker Compose publisher for emitting a docker-compose.yml declaration
- Azure publisher for emitting the Bicep associated with Azure resources
- Kubernetes publisher for emitting the Helm charts associated with a Kubernetes configuration

These assets can be used to initiate deployments to Azure, run Kubernetes clusters, and so on...but they don't do the _actual_ work of initiating the deployments. That's where the `aspire deploy` command comes in. Like the publish command, it's hooked up to a series of APIs within the framework that allow you to define custom behavior during deployment. As of this writing, the only built-in implementation for deployment is to Azure, although it's possible to implement custom behavior independently (like I did in [this blog post]()). The Azure deployer takes the static assets that would've been published by the Azure publisher and executes the deployment. It compiles Bicep to ARM, sends provisioning requests for resources to Azure, builds compute images when needed, and deploys compute resources to the target environments.

Now that we have two related but distinct commands, we need a clear sense of what each one does. There's no disagreement about what deploy should do:

- Build and push container images associated with compute resources
- Prompt for values needed during deployment or resolve them from configuration

The point of tension is about what `publish` does. There have been various stances on the role publish plays. One position is that publish allows you to "eject" out of the Aspire application model for building your own deployment infrastructure. Another is that publish allows you to audit the behavior that the deploy command will execute. Those are subtle and distinct things, and they come to a head when we think about whether or not we should do container image builds during publish.

## The "Ejection" Stance

Let's talk first about the stance that the primary intention of the `publish` command is to allow you to eject out of the Aspire ecosystem and implement your own deployment logic in your tool of choice. This might be a homespun shell script, a GitHub Actions pipeline that uses the `az` CLI, or even the `azd` CLI with a pointer to the generated Bicep. When we take this approach, we have to answer the question of how "complete" the generated assets are. Getting a bunch of YAML and Bicep out of the app model in Aspire is helpful, but there's still some legwork you need to apply to actually turn them into deployable assets. Maybe you need to generate secrets and store them securely for use in the deployment, maybe you need to build container images, maybe you need to wire up custom domains and interact with intermediary components. How do you figure all this out? How much does the publisher give you out of the box?

We debated options that ranged from:

- **Pipeline publishers** that could emit a GitHub Actions or Azure DevOps pipeline that understood how to take the outputs of the `aspire publish` command and deploy them
- **Shell scripts** that would execute all of the steps involved in the deployment for you
- **A README** that would describe the steps required to complete the deployment (e.g. acquire these secrets, build images, etc.)
- **A Copilot prompt** that you could paste to deploy the application based on the published assets -- don't worry this one was mostly a joke ;)

These options are listed in order of most to least effort required to get things working outside of Aspire, and they all beg the question of whether it might be better to let you interact more closely with the steps associated with the deployment within Aspire itself. After all, one of the big values of Aspire is the code-first nature of all of its features.

## The "Auditing" Stance

This brings me to the second stance, which is more about auditing the behavior of the `aspire deploy` command and allowing the end-user to examine each of the underlying steps that the deployment takes and interact with the inputs/outputs that these steps require and generate, respectively. As it turns out, this stance doesn't require that you publish assets at all. Instead, it's about providing more fine-grained control over the steps that the `aspire deploy` command takes. You could imagine the following interaction patterns:

> Note: the command below are theoretical and illustrative. As you might imagine, things are subject to change, especially with the design space being so fresh.

### `aspire deploy`

`aspire deploy` is the one-shot command for users who want their AppHost deployed directly, without introspection or intervention. It would execute all the required deployment steps in one shot.

### `aspire deploy --dry-run`

Adding a `--dry-run` flag to the deploy command lets you see the deployment steps that would be executed, their required inputs, and their expected outputs. For example, if you were to run the command in an AppHost configured to support Azure deployment as described above, you might see the following:

```bash
$ aspire deploy --dry-run
Step 1: buildImages
  Inputs: DockerfileContext, ImageName, Tags
  Outputs: ImageDigest, ImageUri

Step 2: provisionResources
  Inputs: BicepTemplate, ParameterValues
  Outputs: ResourceIds, Endpoints

Step 3: deployCompute
  Inputs: ImageUri, ResourceIds, Configuration
  Outputs: DeploymentStatus, ApplicationUrl
```

### `aspire deploy --step buildImages`

Once you've examined the steps that are to be executed against a given AppHost, you can invoke each step independently with the `--step` flag. You can do this within the context of a shell script, GitHub Action, etc. as you would with the deployment assets generated from `aspire publish`, but in all these cases, Aspire itself is the runner executing the core logic. This subtle distinction ends up having a bunch of trickle-down benefits, including making it possible to build more complex deployment pipelines on top of Aspire as the core runner and the opportunity to make those pipelines debuggable because most of the logic is stored within the Aspire application model.

## Fin

This space is interesting, fresh, and evolving so things are bound to change, but the key design points at the moment are shaping up to be:

- The `publish` command can either enable users to eject from Aspire's ecosystem with static assets, or serve as a way to audit and understand the steps that `deploy` will execute.
- When ejecting via `publish`, there's tension around how "complete" the generated assets should be. Do we generate pipelines, scripts, READMEs, or leave integration work to the user?
- Rather than requiring full ejection, allowing step-by-step execution via `--step` flags keeps users within the Aspire ecosystem while providing transparency and control.
- Keeping deployment logic within Aspire (rather than external scripts/tools) enables better debugging, composability, and integration with the Aspire app model.