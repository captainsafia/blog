---
title: "Fixing Aspire's image problem: a look at container registry support in 13.1"
description: "Exploring the improvements to custom image registry support in Aspire 13.1, and why explicit modeling beats implicit behavior."
---

The release of Aspire 13.1 is right around the corner (yes, it happens that fast), so I figured I'd dump my thoughts on what I spent a bulk of the time working on this release: improving custom image registry support in Aspire. One of the core primitives in the Aspire app model is the ability to define services and their resource dependencies. Another core primitive is to be able to project that representation of your service that you have in code to a cloud deployment. In turn, generating container images and pushing them to registries is a key aspect of materializing the app structure you model in Aspire into an actual cloud deployment.

As it turns out, a bunch of this work boiled down into one major learning: explicit is better than implicit. Let's dig into why. Say you have an AppHost structure that looks like this:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

builder.AddAzureContainerAppEnvironment("env");

var database = builder.AddPostgres("myapp-db");

var api = builder.AddCSharpApp("api", "./api.cs")
    .WithHttpEndpoint()
    .WithReference(database);

builder.AddViteApp("frontend", "./frontend")
    .WithReference(api);

builder.Build().Run();
```

The `AddAzureContainerAppEnvironment` line here is doing a ton of heavy lifting. Behind the scenes, it registers a set of hooks that will inspect the app model for any compute resources and project them to their deployment target representations. In the case of a compute resource deployed to Azure Container Apps, its deployment target representation will consist of an Azure Bicep-resource modeled in code that describes the actual configuration of the container app, including:

- The container image associated with the container app instance that is running
- Any ingress routing policies that need to be configured on the container app
- Any environment variables that need to be injected into the application

In addition to creating these deployment target projections, the `AddAzureContainerAppEnvironment` API also injects an `AzureContainerAppEnvironmentResource` into the app model, which behind the scenes encapsulates the Bicep representation of the Azure Container App Environment. The environment consists of the ACA environment itself, the log analytics workspace associated with it, _and_ the Azure Container Registry that images will be pulled and pushed from.

## The problem with implicit registries

Here's where things got tricky. The ACR was provisioned implicitly as part of the ACA environment, which created a few problems. First, it was hard to discover the implicit registry in the app model. ACR is provisioned as part of the ACA environment and we don't get access to its outputs until the deployment of the entire environment completes. Second, since the registry was bundled with the environment, we couldn't start pushing container images until the _entire_ environment finished provisioning. That includes the ACA environment itself, the log analytics workspace, and even the Aspire dashboard container. Finally, if any part of the environment provisioning failed (say, the dashboard container hit an error or the log analytics workspace was misconfigured), the entire registry was unavailable. Image pushes would fail even though the ACR itself might have provisioned successfully.

## Explicit is better than implicit

The fix? Model the registry explicitly and separately from the ACA environment. By splitting the registry out as its own resource:

- We can start pushing container images as soon as the registry is provisioned, without waiting for the rest of the environment
- Image pushes are no longer affected by errors in other parts of the environment provisioning
- The registry is a first-class citizen in the app model, making it easier to reference and customize

Leaning into the theme of granularity, splitting the registry from the ACA environment all-up means that we can parallelize more of the deployment process. The more we can break down the deployment into independent steps, the faster and more resilient the overall process becomes. If you've been following my posts on [Aspire Pipelines]({% post_url /2025/2025-11-03-aspire-pipelines %}), you'll recognize this pattern: granularity enables concurrency.

It's worth noting that while I've mentioned Azure Container Apps here, this change applies to App Service Environments as well, which also need an ACR provisioned in order to support image pushes. The same benefits around explicit modeling and more granular provisioning apply there.

## Modeling push as a pipeline step

OK, the explicit modeling of the registry is nice. Since explicit modeling is the name of the game, what else can we explicitly model? The action associated with pushing the container images.

As mentioned in previous posts, we now model the deployment process that an Aspire app is associated with into a set of pipeline steps. In previous releases, we explicitly modeled steps associated with provisioning Azure resources and building container images. Naturally, we can do the same for the action of pushing images. In this case, individual compute resources register their push behavior in pipeline steps on the resource. The registries that are modeled in the Aspire app model are responsible for discovering all these push steps and wiring them up to a top-level entrypoint. This means that when you run:

```bash
aspire do push
```

On the following AppHost:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

builder.AddAzureContainerAppEnvironment("env");

var api = builder.AddCSharpApp("api", "./api.cs")
    .WithHttpEndpoint();

var worker = builder.AddCSharpApp("worker", "./worker.cs");

builder.Build().Run();
```

Aspire will:

- Provision your ACR
- Build the container images associated with the compute resources mentioned
- Push the images to the ACR that has been provisioned

This decoupling of registration and discovery means we can push images for individual resources without pushing others (`aspire do push` vs `aspire do push-api`), register multiple registries in the app model and associate them with different compute resources, and run push operations in parallel with other deployment steps that don't depend on them.

## Supporting non-Azure registries

OK! Last piece of the puzzle. Although Aspire has a first-class integration for Azure Container Registry, the same can't be said for other registries like GitHub Container Registry and DockerHub. To close this gap, there's a new `ContainerRegistryResource` that can be used to parameterize the registry endpoint and repository to support pushing to a variety of registries.

```csharp
var builder = DistributedApplication.CreateBuilder(args);

builder.AddContainerRegistry("docker", "docker.io", "captainsafia");

var api = builder.AddCSharpApp("api", "./api.cs")
    .WithHttpEndpoint();

builder.Build().Run();
```

In the scenario above, images will be pushed to the registry on DockerHub. It's also possible to use this model to push to GitHub Container Registries. In this [sample repo](https://github.com/captainsafia/aspire-image-push), you'll observe that the AppHost declares a parameterized Container Registry and we use some GitHub Actions-foo to push built images to the container registry associated with that GitHub repo.

```
- name: Push images with Aspire
    env:
        Parameters__registry_endpoint: ghcr.io
        Parameters__registry_repository: ${{ github.repository }}
    run: aspire do push
```

Note: in the example above, the Docker registry is the assumed target for all resources because it's the only registry declared in the app model. When multiple registries are declared, you'll need to specify the target registry using `WithContainerRegistry`.

## Fin

That's the gist of it. Separate the registry from the environment, model push as a pipeline step, and introduce a `ContainerRegistryResource` for non-Azure registries. The theme here is the same as it's been across the deployment story: more granularity means more control. To leave this on a cliff-hanger though: while the story around image _pushes_ has gotten some love, the story for image _pulls_ hasn't gotten the same treatment yet. More on that in a future post... ;)
