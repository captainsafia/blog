---
title: "How does Aspire launch the Azure Functions runtime when you call aspire run?"
description: "A behind-the-scenes look at how Aspire launches the Azure Functions runtime locally, leveraging a clever .NET SDK feature to make it all work seamlessly."
---

Recently, someone was curious on an internal channel about how the Azure Functions integration for Aspire worked. Specifically, how the integration went about launching the Functions runtime locally when the user launches their Aspire app. I figured it's worth immortalizing the behind-the-scenes details of this in a post since there are some fairly novel things going on here.

First things first, let's get the basic details out of the way.

- Azure Functions is a serverless compute platform that allows you to write code that is invoked by triggers. It supports workers written in multiple languages including C#, JavaScript, and Python. I'm calling out all these languages because at some point I'll write a little bit more about the intersection of polyglot Functions and Aspire.
- These workers are invoked and managed by the Functions host, a .NET-based runtime process. The host communicates with workers over a gRPC channel to facilitate interactions. This is how the isolated worker model works, which is the recommended model going forward now that the in-process model is on its way out.
- When you run Functions locally, you launch the Functions host via the Azure Functions Core Tools by running `func start`. This command takes care of launching the Functions runtime for you locally.

OK, so that's the basic machinery that is involved when you run Azure Functions locally. What happens when you wire them up into an Aspire AppHost?

```csharp
var builder = DistributedApplication.CreateBuilder(args);

builder.AddAzureFunctionsProject<Projects.Functions>("my-func-app");

builder.Build().Run();
```

The code above registers a Functions project that's been referenced by the AppHost. When we call `aspire run`, the Functions runtime will launch and set up the Functions worker defined in the project. How does this work?

## The magic behind `dotnet run`

It takes advantage of a neat feature in the .NET SDK that allows you to override what command gets invoked when the user calls `dotnet run`. The SDK exposes a set of MSBuild properties, `RunCommand`, `RunArguments`, and `RunWorkingDirectory`, that let you customize exactly what happens during the run phase. In the Functions SDK, you'll see [some code that looks like this](https://github.com/Azure/azure-functions-dotnet-worker/blob/51bc63e780724aaf0d3b0b0387c200ba5e5d945d/sdk/Sdk/Targets/Microsoft.Azure.Functions.Worker.Sdk.targets#L107):

```xml
<Target Name="_FunctionsComputeRunArguments" BeforeTargets="ComputeRunArguments" DependsOnTargets="_FunctionsCheckForCoreTools">
    <!-- Windows Configuration -->
    <PropertyGroup Condition="'$(OS)' == 'Windows_NT'">
        <RunCommand>cmd</RunCommand>
        <RunArguments>/C func start $(RunArguments)</RunArguments>
        <RunWorkingDirectory>$(OutDir)</RunWorkingDirectory>
    </PropertyGroup>

    <!-- Unix/Linux/macOS Configuration -->
    <PropertyGroup Condition="'$(OS)' != 'Windows_NT'">
        <RunCommand>func</RunCommand>
        <RunArguments>start $(RunArguments)</RunArguments>
        <RunWorkingDirectory>$(OutDir)</RunWorkingDirectory>
    </PropertyGroup>
  </Target>
```

Let's break this down. The `_FunctionsComputeRunArguments` target runs before `ComputeRunArguments` (the standard SDK target that figures out how to run your project). It overrides the default behavior to invoke the Azure Functions Core Tools (`func`) instead of the built .NET executable. On Windows, it uses `cmd /C func start` because the shell needs to resolve the `func` command. On Unix-like systems, it invokes `func start` directly. In both cases, the working directory is set to the output directory where the compiled Functions project lives.

## Tying it all together with Aspire

When you call `aspire run`, Aspire will call `dotnet run` on the referenced projects. Because of the MSBuild magic above, that `dotnet run` invocation turns into `func start` against the output directory. This magic is what lets us automatically launch the Functions runtime without any explicit wiring on the user-facing side.

The beauty of this approach is that Aspire doesn't need to know anything special about Azure Functions. It just relies on the standard `dotnet run` contract, and the Functions SDK handles the rest. This is a nice example of how layered extensibility in the .NET ecosystem can create seamless integrations without tightly coupling components together.

It's important to note that this functionality only kicks in when you are launching Aspire via the CLI (`aspire run`) or via the VS Code extension for Aspire. Visual Studio has a separate process for launching the Functions runtime concurrently alongside the Aspire AppHost. This is because Visual Studio has its own debugging infrastructure that needs to attach to both the Functions runtime and the worker process, so it takes a more hands-on approach to orchestrating the launch sequence.

So there you have it: a small but clever use of MSBuild extensibility that makes the Aspire + Azure Functions integration feel like magic. A nice side-effect here is that it makes the experience for using Azure Functions _without_ Aspire better too since you can just `dotnet run` your .NET-based Azure Functions the same way you would any other .NET project. A rising tide lifts all boats!