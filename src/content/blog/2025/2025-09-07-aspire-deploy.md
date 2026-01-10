---
title: Building custom deployment pipelines with Aspire
description: A blog post about how to use Aspire to deploy a static site to Azure Storage with Azure Front Door as a CDN and some exploration of Aspire's evolving deployment abstractions.
tags: [aspire, deployment, azure]
---

I've been spending a lot of time lately working on the deployment story for Aspire. As a part of this, I had to go on a side-quest to figure out if our deployment abstractions in Aspire could be used to deploy to a non-standard environment: a static website generated from a Vite app deployed to an Azure Storage blob and placed behind an Azure Front Door.

Side-note: I can this a non-standard environment because Aspire's primary deployment environment has typically been Azure Container Apps (for Azure) although this space is evolving and more deployment environments will be added in the future.

I figured writing a blog post about it would be a great way to talk about how some of the deployment abstractions in Aspire are shaping up and share a bit about how the space is progressing.

## Setting Up the Foundation

For the purposes of this blog post, let's start with a basic Vite app:

```bash
$ npm create vite@latest static-site -- --template vanilla-ts
```

We'll use Aspire to orchestrate our application's cloud deployment. Using the Aspire CLI, we'll create a new Aspire apphost:

```bash
$ aspire new aspire-apphost
```

**Note:** You can acquire the Aspire CLI using the following command. Since the deployment abstractions are hot off the presses, I recommend installing the dev builds of the CLI if you're following these instructions:

```bash
curl -sSL https://aspire.dev/install.sh | bash -s -- -q dev
```

To help us wire up our Node app, we'll use `aspire add` to register some helpers for working with Node-based applications:

```bash
$ aspire add nodejs
$ aspire add communitytoolkit-nodejs-extensions
```

Then, we'll update our app host to include the Vite app in our orchestration:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

builder.AddViteApp("static-site", "../static-site")
       .WithNpmPackageInstallation();

builder.Build().Run();
```

With that in place, we should be able to run `aspire run` and view the Aspire dashboard and our Vite app running locally.

Nice! But we're more interested in what's going to happen in the cloud than what happens in local development, so let's turn our sights onto how we can support deploying this site to production. There are a couple of choices that exist for deploying a static site to the web, but for the purposes of this blog post, we'll focus on the choice to use Azure Storage to host our static assets and Azure Front Door for CDN, routing, and SSL termination.

## The Deployment Architecture

You can view the entire deployment logic for this [here](https://github.com/captainsafia/aspire-static-site-deploy/blob/main/static-site-aspire/AppHost.cs), but let's break down some of the key things that are happening in the file.

First things first, all great things start with the AppHost. The `AddAzureStorageHosting` method encapsulates all the behavior that we need for our deployment configuration:

```csharp
builder.AddAzureStorageHosting("deploy");
```

## Understanding Aspire Execution Modes

The first chunk of code in the extension method seems innocuous, but there's actually some interesting stuff to discuss around it:

```csharp
if (builder.ExecutionContext.IsRunMode)
{
    return builder;
}
```

When you run an Aspire AppHost, it can be in one of two modes. `RunMode` is active when you call `aspire run`, as you would in in a typical dev flow on your local machine. `PublishMode` is active when you run the AppHost with `aspire publish` and `aspire deploy`. Yes, there's no distinct `DeployMode` in Aspire at the moment. There's been a fair bit of discussion around whether or not this is a good idea. On the one hand, there is a lot of code written that assumes only two modes that an Aspire app can run in - introducing another would introduce a big behavioral breaking change. On the other hand, not having a distinct `DeployMode` just seems like it's going to bite you at some point. If you do need to determine whether or not Aspire is being run in deploy mode exclusively, you can check the `PublishingOptions` object for the `IsDeploy` property.

## Configuring Azure Storage Infrastructure

Further down in the extension method, we take advantage of the Aspire Azure Storage integration to allocate the Azure storage resource in the subscription. The `ConfigureInfrastructure` API allows us to manipulate the underlying Bicep representation and enable public access on the blob containers in the storage account:

```csharp
var storage = builder.AddAzureStorage($"{name}-storage")
    .ConfigureInfrastructure(infra =>
    {
        var storage = infra.GetProvisionableResources().OfType<StorageAccount>().Single();
        // Required for static website support
        storage.AllowBlobPublicAccess = true;
    });
```

If you haven't seen the `ConfigureInfrastructure` API in Aspire, you should definitely embrace it. It's the canonical way to modify the underlying Bicep templates that will be deployed to Azure. This API is provided by the Azure CDK, which lets us manipulate Bicep in a strongly-typed manner using C# code.

## Working with Custom Azure Resources

Not all Azure resources currently have a first-class API exposed in the CDK. That doesn't mean that you can't take advantage of modeling these as Aspire resources, as you'll see in the next snippet:

```csharp
var frontDoor = builder.AddResource(new AzureFrontDoorResource($"{name}-afd"))
    .WithParameter("frontDoorName", $"{name}-afd")
    .WithParameter("storageAccountName", storage.Resource.NameOutputReference);

class AzureFrontDoorResource(string name) : AzureBicepResource(name, templateFile: "front-door.bicep") { }
```

Since there's no first-class Aspire integration for Azure Front Door yet, we'll quickly roll our own by implementing a simple `AzureBicepResource` wrapper around a pre-existing Bicep file. Because it is modeled as an `AzureBicepResource`, we can interact with the Bicep parameters that are declared in the file. In the case above, we provide a raw string literal as a value for `frontDoorName` and indicate that the output associated with the storage account name from its Bicep file should be used as the value for the `storageAccountName` parameter in the Azure Front Door template. 

When it's time to provision resources, Aspire will handle mapping the outputs from one Bicep file into the deployment parameters associated with another. The outputs exist as state in the `AzureBicepResource` that we can query and interact with from Aspire as well.

So that sets up the stage for the two Azure resources that we need to use during deployment. The actual deployment logic is handled by the next resource that we add to the application model:

```csharp
builder.AddResource(new AzureStorageHostingResource(name));
```

## Custom Deployment Logic with Annotations

The deployment magic in this resource comes from its annotations:

```csharp
Annotations.Add(new DeployingCallbackAnnotation(DeployAsync));
```

The `DeployingCallbackAnnotation` in Aspire has special meaning (a bit obvious, but most annotations are there to drive some sort of behavior). When `aspire deploy` is called, the Aspire runtime will query the application model for any resources that implement this annotation and invoke the callback they provide. 

**Important note:** There's no ordering semantic for these deployment callbacks at the moment - they are executed in order of appearance in the application model. In this particular case, our custom deployment callback will run after the built-in Azure deployer that is implicitly registered by the Azure Storage resource we configured earlier.

This actually ends up being rather helpful because we can access output state from the Azure resource deployments. For example, you'll note that at the end of the `DeployAsync` method we call:

```csharp
var frontDoor = context.Model.Resources.OfType<AzureFrontDoorResource>().Single();
var endpoint = frontDoor.Outputs["endpointUrl"] as string;
await context.ActivityReporter.CompletePublishAsync($"Static site deployed successfully! Access it at: {endpoint}").ConfigureAwait(false);
```

The `endpointUrl` is declared as an output in our Bicep file that we can access for displaying the deployment URL at the end. In another instance, we can resolve the strongly-typed `BlobEndpoint` property from the storage account to funnel into the deployment steps.

## The Deployment Pipeline

Speaking of deployment steps, you'll see the meat of the pipeline is as follows:

```csharp
if (!await TryBuildStaticSite(deploymentStep, context))
{
    return;
}

if (!await TryConfigureStaticWebsite(deploymentStep, blobEndpoint, context))
{
    return;
}

if (!await TryUploadStaticFiles(deploymentStep, blobEndpoint, context))
{
    return;
}
```

Let me break down what each of these steps accomplishes:

- `TryBuildStaticSite` builds the Vite site locally using `npm run build`. This step ensures we have the optimized production assets ready for deployment.
- `TryConfigureStaticWebsite` uses the Azure Storage SDK to update the properties on the storage account to support static website hosting. This configures the storage account to serve files directly and sets up index document routing.
- `TryUploadStaticFiles` uses the Azure Storage SDK to upload the built assets generated in the first step to the `$web` container created implicitly by Azure Storage in the second step.

With all this in place, we can run `aspire deploy` in the app and observe that our static site is deployed to Azure Storage and accessible through Azure Front Door.

## Key Takeaways

As mentioned earlier, the content in this post is fresh off the presses and is subject to change, but some of the evergreen takeaways are:

- **Leverage the AppHost for everything:** With Aspire, you want to do as much as possible using code that runs in the AppHost. Even when CDKs are not available for Azure resources, we can create lightweight wrappers that allow us to take advantage of them elsewhere in the Aspire ecosystem.

- **Understand deployment callbacks:** The `DeployingCallbackAnnotation` carries special meaning and allows us to describe our custom deployment pipeline. These callbacks are executed in order of appearance in the app model. Only one `DeployingCallbackAnnotation` per resource is respected - if you add multiple, the last one wins.

- **Embrace ConfigureInfrastructure:** This API is your gateway to customizing the underlying Azure infrastructure beyond what the default integrations provide.

- **Publish vs Deploy:** At the moment, publish and deploy are distinct commands that are not connected. This is actually a fairly recent change in the dev builds of Aspire. Prior to this, calling `aspire deploy` would implicitly also call `aspire publish`.

## What's Next

There are a couple of points I didn't get into deeply in this blog post. One of them is the `ActivityReporter` that you'll see referenced in the GitHub repo - it's how progress about the deployment is communicated from the AppHost to the CLI when the `aspire deploy` command is called. That API is quite interesting and will likely evolve in the future. It's definitely worth a blog post of its own, as it provides a clean way to give users real-time feedback during long-running deployment operations.

Another area worth exploring is how we can build upon this deployment pipeline with more features, like support for custom domains or supporting servicing static assets from our storage account _without_ allowing public blob access.

Finally, it might be worthwhile to dig a bit more into the publish vs. deploy distinctions that exist in Aspire.

If any one of these topics seems more interesting than the other, let me know!

Finally, you can play around with the code for this blog post over at [this GitHub repo](https://github.com/captainsafia/aspire-static-site-deploy).

The combination of Aspire's orchestration capabilities with Azure's infrastructure-as-code approach creates a powerful deployment story that bridges the gap between local development and cloud production environments. As these abstractions continue to mature, I expect we'll see even more sophisticated deployment scenarios become as simple as adding a few lines of code to your AppHost.