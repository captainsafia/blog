---
title: "Anatomy of an API: an existential crisis with AsExisting()"
description: "A blog post dissecting Aspire's RunAsExisting, PublishAsExisting, and AsExisting APIs, why the naming haunts me, and what I would've done differently if I could turn back time."
---

For the most part, this "Anatomy of an API" series has discussed APIs that I'm happy living with. Let's talk about one that I'm not so happy living with. Let's talk about the `RunAsExisting` and `PublishAsExisting` APIs in Aspire (I'm already shaking my head) and why naming an API is a lot like marriage. OK, maybe not that intense but close enough.

If you're reading this, you might already know what [Aspire](https://aspire.dev) is. The relevant bit for the sake of this blog post is around Aspire's ability to model your application's cloud dependencies in code via an infrastructure-as-code model. Something like this:

```csharp
var builder = DistributedApplication.CreateBuilder();

var storage = builder.AddAzureStorage("app-storage");
var database = builder.AddCosmosDb("app-database");
var serviceBus = builder.AddAzureServiceBus("app-service-bus");

builder.Build().Run();
```

By default, the code above will provision the Azure Storage, Azure CosmosDB, and Azure Service Bus instances for you, both when you run your application locally via Aspire's local orchestration or when you deploy your application to a cloud environment with the deployment features. All good and well. But the reality is that most people are dealing with pre-provisioned and static cloud resources in both local development and production scenarios. You might have a test instance of a database that all members of the engineering team connect to. Or your production deployments might consist of storage accounts that are provisioned in dedicated environments. Hence, the need to reference existing resources. Currently, you can do something like this to indicate that existing resources should be referenced instead of provisioning new resources.

```csharp
var builder = DistributedApplication.CreateBuilder();

var existingStorageResourceName = builder.AddParameter("app-storage-resource-name");
var existingStorageResourceGroupName = builder.AddParameter("app-storage-resource-group-name");
var storage = builder.AddAzureStorage("app-storage")
    .RunAsExisting(existingStorageResourceName, existingStorageResourceGroupName);
var database = builder.AddCosmosDb("app-database")
    .PublishAsExisting("existing-cosmosdb", "rg-shared");
var existingServiceBusName = builder.AddParameter("app-service-bus-name");
var existingServiceBusResourceGroup = builder.AddParameter("app-service-bus-rg");
var serviceBus = builder.AddAzureServiceBus("app-service-bus")
    .AsExisting(existingServiceBusName, existingServiceBusResourceGroup);

builder.Build().Run();
```

Excuse me while I gag. Let's dissect this.

There are three different methods here that change behavior depending on whether you want to use an existing resource during run-mode, publish-mode, or both. `RunAsExisting` tells Aspire to use an existing resource only when running locally. `PublishAsExisting` tells Aspire to use an existing resource only when publishing/deploying. And `AsExisting` tells Aspire to use an existing resource in both scenarios.

This distinction is important because existing resources might differ between local development and production environments. Your team might have a shared test database for local development that's different from the production database. Or you might want Aspire to provision fresh resources locally but point to pre-existing ones in production. The three-method approach gives you the flexibility to express these scenarios.

All three methods require you to provide the name of the existing resource and optionally accept a resource group name. If you don't provide a resource group, Aspire defaults to the one configured in your deployment settings. This keeps things concise when you're working within a single resource group but gives you the escape hatch when you need to reference resources spread across different groups.

Here's where it gets interesting: those values can either be `ParameterResource` references or plain strings. When you use `ParameterResource`, Aspire will prompt for the values during deployment (or resolve them from configuration). When you use strings, the values are fixed at compile time.

## The warts

Now for the part where I air some grievances. The `PublishAsExisting` name has proven to be a brittle choice. In [one of my earlier posts](/2025/10/06/aspire-publish-vs-deploy/), I talked about how the concept of run-mode and publish-mode is becoming blurred in Aspire, especially as we try to bring the model of the application running in the cloud and the one running locally as close to each other as possible. Encoding a now-evolving verb into the API name is...annoying.

There's also the cognitive overhead of having three methods that do essentially the same thing with slightly different scopes. Users have to understand the run-mode vs publish-mode distinction before they can pick the right method. In hindsight, I would've preferred to implement a single `AsExisting` method with an optional parameter like `scope: ExistingResourceScope.RunOnly | PublishOnly | All`. Arguably cleaner, but we're stuck with what we shipped.

Finally, the matrix of method and parameter combinations can be a little intense to keep in your head. Here's all of them modeled in a table:

| Method | Name | Resource Group | Run Mode | Publish Mode |
|--------|------|----------------|----------|--------------|
| `RunAsExisting` | parameter | parameter | uses existing (prompted) | provisions new |
| `RunAsExisting` | parameter | _(default)_ | uses existing (prompted) | provisions new |
| `RunAsExisting` | string | string | uses existing (fixed) | provisions new |
| `RunAsExisting` | string | _(default)_ | uses existing (fixed) | provisions new |
| `PublishAsExisting` | parameter | parameter | provisions new | uses existing (prompted) |
| `PublishAsExisting` | parameter | _(default)_ | provisions new | uses existing (prompted) |
| `PublishAsExisting` | string | string | provisions new | uses existing (fixed) |
| `PublishAsExisting` | string | _(default)_ | provisions new | uses existing (fixed) |
| `AsExisting` | parameter | parameter | uses existing (prompted) | uses existing (prompted) |
| `AsExisting` | parameter | _(default)_ | uses existing (prompted) | uses existing (prompted) |

That's ten permutations across five overloads and three methods. Most of the overloads have the same structure, but notice that `AsExisting` only has two overloads that accept `ParameterResource` types. This asymmetry is intentional here, though. When you're not disambiguating between local development and cloud deployments, we want to force the user to provide different values in either environment to avoid the risk of hard-coding a dev-time resource in production and vice versa.

## If I could do it all over again

So all in all, this API is (in my opinion!) more verbose than it needs to be, too coupled to platform semantics in its naming, and forces you to learn too many concepts at once in order to use it. However, as catastrophic as my tone is in this post, APIs aren't fixed. It's possible to create new APIs and deprecate old ones. If I had to recreate this API from scratch, it would look something like this:

```csharp
public static IResourceBuilder<T> AsExisting<T>(
    this IResourceBuilder<T> builder,
    string name,
    string? resourceGroup = null,
    Func<IsActiveAsExistingContext, bool>? isActiveCallback = null) 
        where T : IAzureResource { }

public static IResourceBuilder<T> AsExisting<T>(
    this IResourceBuilder<T> builder,
    IResourceBuilder<ParameterResource> nameParameter,
    IResourceBuilder<ParameterResource>? resourceGroupParameter = null,
    Func<IsActiveAsExistingContext, bool>? isActiveCallback = null)
        where T : IAzureResource { }

public static IResourceBuilder<T> AsExisting<T>(
    this IResourceBuilder<T> builder,
    string name,
    string? resourceGroup = null,
    Func<IsActiveAsExistingContext, Task<bool>>? isActiveCallback = null) 
        where T : IAzureResource { }

public static IResourceBuilder<T> AsExisting<T>(
    this IResourceBuilder<T> builder,
    IResourceBuilder<ParameterResource> nameParameter,
    IResourceBuilder<ParameterResource>? resourceGroupParameter = null,
    Func<IsActiveAsExistingContext, Task<bool>>? isActiveCallback = null)
        where T : IAzureResource { }
```

The biggest trade-off here is that the mode distinction is relegated to a callback instead of being an explicit on-off switch. Instead of `RunAsExisting` and `PublishAsExisting`, you'd call `AsExisting` and pass a callback that inspects the context to decide whether the existing resource behavior should kick in. This unlocks more dynamic scenarios: maybe you want to use an existing resource only when a certain environment variable is set, or when you're deploying to a specific Azure subscription, or when some feature flag is enabled.

The number of overloads is still pretty big (four!), but they're not cognitively heavy to the user. The two main distinctions are: (1) whether your existing resource name and group name are fixed strings or prompted parameters, and (2) whether your callback is sync or async.

Side note: there's a bit of a meme on the Aspire team about the need to make sure any callback-accepting overloads provide an async entrypoint. If you don't allow it, you'll almost always regret it. Someone will inevitably need to call an async API inside that callback, and then you're stuck wrapping everything in `.Result` or `.GetAwaiter().GetResult()` like a monster. We appreciate our users enough to not force them to do that.

And that's the sordid story of `RunAsExisting`, `PublishAsExisting`, and `AsExisting`. They work, they solve real problems, but they're a reminder that the API shape you choose today might haunt you tomorrow. Hazard of the trade, I guess!