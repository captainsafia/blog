---
title: "How does Aspire expose resource connection info to the Azure Functions runtime?"
description: "A deep dive into IResourceWithAzureFunctionsConfig and how it enables Aspire to inject the right connection string references that Azure Functions expects."
---

This is yet another off-the-cuff blog post about a detail of the Aspire and Azure Functions integration that came up recently. It's interesting to talk about because it covers some of the opinions Aspire holds about how connection information is propagated to services and where those opinions might start to fall apart.

When you use `WithReference` to wire up references to Azure resources on regular projects, Aspire injects the connection string to that resource as an environment variable to the running service. On the client side, Aspire client integrations can consume these environment variables via configuration and use them to configure clients that interact with that resource. 

When you wire up an Azure Functions project in Aspire with references to Azure resources like Storage, Service Bus, or Event Hubs, something more has to happen under the hood. The Azure Functions runtime has very specific expectations about how connection strings and service URIs are configured, and those expectations don't align with how Aspire typically injects configuration.

This is where [`IResourceWithAzureFunctionsConfig`](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure/IResourceWithAzureFunctionsConfig.cs) comes in. It's a special interface that allows Azure resource implementations in Aspire to provide configuration in a way that the Functions runtime understands.

## The problem: two config systems, one runtime

When you reference an Azure resource from a Functions project in Aspire, there are actually two different configuration systems that need to be satisfied. The Functions runtime needs specific configuration keys to initialize triggers and bindings. For example, a blob trigger needs to know how to connect to Storage, an Event Hub trigger needs the fully qualified namespace of the EventHub to connect to, and so on. If your Functions code also uses Aspire's client integrations (like `Aspire.Azure.Storage.Blobs` or `Aspire.Azure.Messaging.ServiceBus`), those libraries have their own configuration key patterns that they expect.

Azure Functions tends to use flat configuration keys like `MyConnection__fullyQualifiedNamespace`, while Aspire client integrations follow a pattern like `Aspire__Azure__Messaging__ServiceBus__MyConnection__FullyQualifiedNamespace`. When you write code that looks like this:

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var storage = builder.AddAzureStorage("storage");
var blobs = storage.AddBlobs("blobs");

var queue = builder.AddAzureServiceBus("messaging")
    .AddQueue("orders");

builder.AddAzureFunctionsProject<Projects.MyFunctions>("functions")
    .WithReference(blobs)
    .WithReference(queue);

builder.Build().Run();
```

Aspire needs to inject configuration that works for both the Functions runtime triggers **and** any Aspire client code you're using inside your Functions.

## Enter IResourceWithAzureFunctionsConfig

The `IResourceWithAzureFunctionsConfig` interface provides a contract that Azure resource types can implement to customize how they inject configuration into Functions projects:

```csharp
public interface IResourceWithAzureFunctionsConfig : IResource
{
    void ApplyAzureFunctionsConfiguration(
        IDictionary<string, object> target,
        string connectionName);
}
```

This interface is implemented by almost all the major Azure resource types in Aspire: [`AzureStorageResource`](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.Storage/AzureStorageResource.cs), [`AzureBlobStorageResource`](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.Storage/AzureBlobStorageResource.cs), [`AzureServiceBusResource`](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.ServiceBus/AzureServiceBusResource.cs), [`AzureEventHubsResource`](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.EventHubs/AzureEventHubsResource.cs), [`AzureCosmosDBResource`](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.CosmosDB/AzureCosmosDBResource.cs), and their child resources. Since we only need to support this interface on resources that also have an Azure Functions trigger, the scope is pretty limited.

When you call `WithReference` on an Azure Functions project resource, Aspire checks if the referenced resource implements this interface. If it does, it calls `ApplyAzureFunctionsConfiguration` to let the resource inject its configuration directly into the Functions project's environment variables.

You can see this in action in the [`AzureFunctionsProjectResourceExtensions.cs` file](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.Functions/AzureFunctionsProjectResourceExtensions.cs#L227) where we use the functionality to inject the connection info for the Azure Storage instance that Functions uses for its own bookkeeping:

```csharp
.WithEnvironment(context =>
{
    // ... other configuration ...

    // Set the storage connection string.
    ((IResourceWithAzureFunctionsConfig)resource.HostStorage)
        .ApplyAzureFunctionsConfiguration(
            context.EnvironmentVariables,
            "AzureWebJobsStorage");
})
```

Let's look at how [`AzureServiceBusResource`](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.ServiceBus/AzureServiceBusResource.cs) implements this interface to understand the pattern. The implementation needs to handle two scenarios: running against the local emulator and running against Azure.

When running against the emulator, the Functions runtime expects traditional connection strings:

```csharp
if (IsEmulator)
{
    // Injected to support Azure Functions listener initialization.
    target[$"{connectionName}"] = ConnectionStringExpression;

    // Injected to support Aspire client integration for Service Bus.
    target[$"Aspire__Azure__Messaging__ServiceBus__{connectionName}__ConnectionString"] =
        GetConnectionString(queueOrTopicName, subscriptionName);
}
```

The code comments in the snippet clarify why it injects the connection strings twice: once under `{connectionName}` for the Functions runtime to find, and once under the Aspire client integration key pattern for client libraries to use.

When you're running against real Azure resources, the Functions runtime prefers identity-based connections using fully qualified namespaces:

```csharp
else
{
    // Injected to support Azure Functions listener initialization.
    target[$"{connectionName}__fullyQualifiedNamespace"] = ServiceBusEndpoint;

    // Injected to support Aspire client integration for Service Bus.
    target[$"Aspire__Azure__Messaging__ServiceBus__{connectionName}__FullyQualifiedNamespace"] =
        ServiceBusEndpoint;

    if (queueOrTopicName is not null)
    {
        target[$"Aspire__Azure__Messaging__ServiceBus__{connectionName}__QueueOrTopicName"] =
            queueOrTopicName;
    }
}
```

Again, dual injection: one set of keys for Functions runtime trigger initialization another for Aspire client integrations.

## The WithReference overload

The last piece of the puzzle is the specialized [`WithReference` overload](https://github.com/dotnet/aspire/blob/main/src/Aspire.Hosting.Azure.Functions/AzureFunctionsProjectResourceExtensions.cs#L337) for Functions projects. Unlike the standard `WithReference` that other project types use, the Functions-specific version looks for resources that implement `IResourceWithAzureFunctionsConfig`:

```csharp
public static IResourceBuilder<AzureFunctionsProjectResource> WithReference<TSource>(
    this IResourceBuilder<AzureFunctionsProjectResource> destination,
    IResourceBuilder<TSource> source,
    string? connectionName = null)
    where TSource : IResourceWithConnectionString, IResourceWithAzureFunctionsConfig
{
    destination.WithReferenceRelationship(source.Resource);

    return destination.WithEnvironment(context =>
    {
        connectionName ??= source.Resource.Name;
        source.Resource.ApplyAzureFunctionsConfiguration(
            context.EnvironmentVariables,
            connectionName);
    });
}
```

The key constraint in that generic type parameter is that the resource must implement BOTH `IResourceWithConnectionString` and `IResourceWithAzureFunctionsConfig`. This ensures that only resources that can provide connection information in the format that Functions expects can be passed to `WithReference`.

## Fin

This blog post covered a lot of how, but let's hone in on the why a bit more. Earlier, I mentioned the fact that Aspire's hosting and client integrations have opinions on the format that connection information is transferred over. This opinion works well when the consumer of these connection details is an Aspire-aware component like the resource integrations. Things get a little hairy when the consumer is _not_ an Aspire-aware component, like the Functions runtime. Interfaces like the `IResourceWithAzureFunctionsConfig` abstract this inconsistency from users so they can focus on the desired end goal: wiring up the references in their service architecture.

There are other solutions that could be pursued here, namely making the Azure Functions runtime Aspire-aware and teaching it about Aspire's connection-string format. That comes with its own baggage though: the Functions runtime would need to become aware of the environment it is running in and take on a dependency on Aspire-specific conventions. That tightly couples the two systems together in a way that doesn't feel great from a design perspective. Functions should be able to run independently of Aspire, and Aspire should be able to orchestrate Functions without the runtime needing to know about it.

The adapter pattern that `IResourceWithAzureFunctionsConfig` provides keeps these concerns separated. The Azure resource implementations in Aspire know how to speak both languages, and they handle the translation so neither the Functions runtime nor the Aspire client integrations need to change. It's a pragmatic solution to a problem that comes up whenever you're trying to integrate systems with different opinions. Sometimes the cleanest approach is to build a bridge that speaks both languages fluently. There's a life lesson in there somewhere...
