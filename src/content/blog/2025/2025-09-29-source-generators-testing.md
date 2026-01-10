---
title: Verifying the source of (generator) truth
description: A deep dive into testing infrastructure I built for incremental .NET source generators, covering compile-time validation, runtime behavior verification, and incremental compilation testing.
tags: [source-generators, .net, testing, aot, csharp]
---

Over the past few years, I've had the chance to work on a number of features in .NET that take a dependency on source generators. In that time, I've had the chance to refine the strategy that I use to verify the validity of those source generators at both compile-time and run-time. In this blog post, I'll walk through the gist of the test setup that I use and how it has evolved over time.

## What and Why?

First, a quick primer on source generators. Source generators are a compile-time code generation feature that allow you to inspect user code and generate additional C# source files during compilation. Unlike T4 templates or other code generation approaches, source generators run as part of the compilation process and can analyze existing code to make informed decisions about what to generate. They're particularly useful for eliminating reflection-heavy scenarios and enabling ahead-of-time (AOT) compilation scenarios. They’ve been very useful in the development of various AoT-friendly implementations in ASP.NET Core, like the design for request binding logic for minimal APIs or JSON serialization. With the power of this this tool comes the responsibility to ensure that the generated code is correct, performant, and maintains compatibility across different scenarios.

With that in mind, for a typical source generator, I want to verify the following behaviors:

- The source generated code is syntactically correct and produces no error or warning diagnostics during compilation. These can be a particularly pain for the user because outside of disabling the warning diagnostics that are emitted, the end-user can’t influence the generated code to fix it.
- The code generated executes correctly at runtime and produces the expected behavior when integrated with the rest of the application.
- Most generators these days are incremental generators, which means they consists of steps that run in a pipeline. Whenever the result of one of the steps doesn’t change between calls to the generator, the remaining steps are not executed. Essentially, it gives you the ability to implement caching semantics in your generator so code is only generated if it needs to be. Validating that a generator is truly incremental and caching correctly can be tricky but there are strategies that exist for doing this.

## A walk-through from a real-world test case

With that in mind, we'll take a look at how these principles are applied in the test infrastructure for the [validations source generator](https://github.com/dotnet/aspnetcore/blob/bb2d778dc66aa998ea8e26db0e98e7e01423ff78/src/Validation/test/Microsoft.Extensions.Validation.GeneratorTests/ValidationsGeneratorTestBase.cs) and [OpenAPI XML support generator](https://github.com/dotnet/aspnetcore/blob/bb2d778dc66aa998ea8e26db0e98e7e01423ff78/src/OpenApi/test/Microsoft.AspNetCore.OpenApi.SourceGenerators.Tests/SnapshotTestHelper.cs) from the ASP.NET Core repository. You can learn more about these generators in the sample repos I’ve created [here for the validations generator](https://github.com/captainsafia/minapi-validation-support) and [here for the OpenAPI XML support generator](https://github.com/captainsafia/aspnet-openapi-xml).

There’s a few differences in the test infrastructure for each one, but not any that are meaningful enough to dig into. To illustrate things, let’s take a look at [a test case for the validations generator.](https://github.com/dotnet/aspnetcore/blob/bb2d778dc66aa998ea8e26db0e98e7e01423ff78/src/Validation/test/Microsoft.Extensions.Validation.GeneratorTests/ValidationsGenerator.Parameters.cs#L11):

```csharp
public partial class ValidationsGeneratorTests : ValidationsGeneratorTestBase
{
    [Fact]
    public async Task CanValidateParameters()
    {
        var source = """
using System;
using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Validation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder();

builder.Services.AddValidation();
builder.Services.AddSingleton<TestService>();
builder.Services.AddKeyedSingleton<TestService>("serviceKey");

var app = builder.Build();

app.MapPost("/params", (
    // Skipped from validation because it is resolved as a service by IServiceProviderIsService
    TestService testService,
    // Skipped from validation because it is marked as a [FromKeyedService] parameter
    [FromKeyedServices("serviceKey")] TestService testService2,
    [Range(10, 100)] int value1,
    [Range(10, 100), Display(Name = "Valid identifier")] int value2,
    [Required] string value3 = "some-value",
    [CustomValidation(ErrorMessage = "Value must be an even number")] int value4 = 4,
    [CustomValidation, Range(10, 100)] int value5 = 10,
    // Skipped from validation because it is marked as a [FromService] parameter
    [FromServices] [Range(10, 100)] int? value6 = 4,
    Dictionary<string, TestService>? testDict = null) => "OK");

app.Run();

public class CustomValidationAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value is int number && number % 2 == 0;
}

public class TestService
{
    [Range(10, 100)]
    public int Value { get; set; } = 4;
}
""";
        await Verify(source, out var compilation);
        await VerifyEndpoint(compilation, "/params", async (endpoint, serviceProvider) =>
        {
            var context = CreateHttpContext(serviceProvider);
            context.Request.QueryString = new QueryString("?value1=5&value2=5&value3=&value4=3&value5=5");
            await endpoint.RequestDelegate(context);
            var problemDetails = await AssertBadRequest(context);
            Assert.Equal(2, problemDetails.Errors.Length);
        });
    }
}
```

The test aims to validate that the validations source generator behaves correctly with a number of scenarios involving parameters in minimal APIs. The setup consists of a string literal that comprises a full-fledged minimal API application that registers endpoints and starts the application service. It also includes usings for all the references that are used by the code, specifically because the tests are generated in a context where global usings are not available.
Next, the tests call into two methods on the base class, `Verify` and `VerifyEndpoint`, that validate the behavior of the generated code and its runtime behavior respectively. This two-phase approach ensures both compile-time correctness and runtime functionality.

### Validating compile-time behavior

If we take a look at the `ValidationsGeneratorTestBase` ([ref](https://github.com/dotnet/aspnetcore/blob/bb2d778dc66aa998ea8e26db0e98e7e01423ff78/src/Validation/test/Microsoft.Extensions.Validation.GeneratorTests/ValidationsGeneratorTestBase.cs)) class and the `Verify` method that is invoked, we'll note that it sets up a compile-and-run infrastructure for the source generator. There are several key considerations that went into this setup:

1. **Reference Assembly Loading**: Any source generator that tests a complete set of behavior will likely need to reference APIs in base class libraries or in the ASP.NET Core shared framework. The test infrastructure dynamically loads all available assemblies to ensure the compilation context matches a real-world scenario.
2. **Roslyn Compilation Setup**: A Roslyn compilation is generated with the string that represents the source code, with all necessary references and compilation options.
3. **Generator Driver Execution**: Roslyn's `CSharpGeneratorDriver` is used to run the generator on the compilation containing the input code to produce a new compilation that includes the generated code.
4. **Snapshot Testing Integration**: The Verify.SourceGenerators API is used to validate that the generated source matches expected output through snapshot testing, making it easy to detect unintended changes in generator behavior.

```csharp
[UsesVerify]
public partial class ValidationsGeneratorTestBase
{
    internal static Task Verify(string source, out Compilation compilation)
    {
        var references = AppDomain.CurrentDomain.GetAssemblies()
                .Where(assembly => !assembly.IsDynamic && !string.IsNullOrWhiteSpace(assembly.Location))
                .Select(assembly => MetadataReference.CreateFromFile(assembly.Location))
                .Concat([]);
        
        var inputCompilation = CSharpCompilation.Create("ValidationsGeneratorSample",
            [CSharpSyntaxTree.ParseText(source, options: ParseOptions, path: "Program.cs")],
            references,
            new CSharpCompilationOptions(OutputKind.ConsoleApplication));
        
        var generator = new ValidationsGenerator();
        var driver = CSharpGeneratorDriver.Create(generators: [generator.AsSourceGenerator()], parseOptions: ParseOptions);
        
        return Verifier
            .Verify(driver.RunGeneratorsAndUpdateCompilation(inputCompilation, out compilation, out var diagnostics))
            .ScrubLinesWithReplace(line => InterceptsLocationRegex().Replace(line, "[InterceptsLocation]"));
    }
}
```

The `ScrubLinesWithReplace` call at the end is worth calling out. This particular generator makes use of interceptors  features in the C# language which [you can read more about here](https://github.com/dotnet/roslyn/blob/main/docs/features/interceptors.md). It works by allowing us to decorate a source generated method with an attribute that indicates that a given callsite should invoke the generated method. The attribute consists of a semi-stable hash that might change if the line-of-code a callsite is at changes. To make the snapshot tests more stable, we normalize the value so that our snapshots are stable. 

### Validating run-time behavior

This covers the portions of the test infrastructure that are related to the verification of the compilation process related to the tests. The next portion of the setup involves verifying that the generated code executes correctly and is encapsulated in the `VerifyEndpoint` method. 

```csharp
internal static async Task VerifyEndpoint(Compilation compilation, string routePattern, Func<Endpoint, IServiceProvider, Task> verifyFunc)
{
    if (TryResolveServicesFromCompilation(compilation, 
        targetAssemblyName: "Microsoft.AspNetCore.Routing", 
        typeName: "Microsoft.AspNetCore.Routing.EndpointDataSource", 
        out var services, 
        out var serviceType, 
        out var outputAssemblyName) is false)
    {
        throw new InvalidOperationException("Could not resolve services from compilation.");
    }
    
    var service = services.GetService(serviceType) ?? throw new InvalidOperationException("Could not resolve EndpointDataSource.");
    var endpoints = (IReadOnlyList<Endpoint>)service.GetType()
        .GetProperty("Endpoints", BindingFlags.Instance | BindingFlags.Public)
        .GetValue(service);
    var endpoint = endpoints.FirstOrDefault(endpoint => endpoint is RouteEndpoint routeEndpoint && 
        routeEndpoint.RoutePattern.RawText == routePattern);
    
    await verifyFunc(endpoint, services);
}
```

Most of the magic is happening in the `TryResolveServicesFromCompilation` method ([ref](https://github.com/dotnet/aspnetcore/blob/bb2d778dc66aa998ea8e26db0e98e7e01423ff78/src/Validation/test/Microsoft.Extensions.Validation.GeneratorTests/ValidationsGeneratorTestBase.cs#L116)) which encapsulates a fair bit of behavior:

- It creates an in-memory representation of the DLL and PDB that is produced from the Roslyn compilation.
- It validates that no diagnostics are emitted in the compilation. This is essential another component of our compile-time checks to validate that the code we produce is syntactically valid.
- It loads the assembly associated with the compilation in the AssemblyLoadContext so that it can be booted by the `HostFactoryResolver`.
- The `HostFactoryResolver` provides a hook into the DI container encapsulated by the host.

From this, we can resolve the actual `Endpoint` that ASP.NET Core stores in the DI container and query it as needed via the `verifyFunc` callback. From the example above, you'll notice this is where we assert on the runtime behavior of the method by sending HTTP requests to the endpoint and asserting on their behavior.

This approach effectively creates a mini-application host, compiles and loads the generated code, and then exercises the runtime behavior through actual HTTP requests. This level of integration testing gives us confidence that the generated code doesn't just compile, but actually works as expected in a realistic scenario.

## Fin

The first iteration of this setup came about while adding the verification tests for the Request Delegate Generator (RDG) for minimal APIs, a source generator that supports generating optimized request handling code for ASP.NET Core endpoints. Over time, the infrastructure has evolved to become more sophisticated and easier to work with.

I'll admit, I find the test infrastructure in newer integrations nicer and more organized. The use of Verify.SourceGenerators for snapshot tests instead of the manual snapshot testing approach used in earlier generators like RDG is definitely a step up. The declarative nature of snapshot testing makes it much easier to review changes and understand what the generator is producing.

The tests for minimal API’s request delegate generator do have a leg up on the more recent integration tests introduced and that’s the fact that they actually validate the [incremental caching used by the generator](https://github.com/dotnet/aspnetcore/blob/bb2d778dc66aa998ea8e26db0e98e7e01423ff78/src/Http/Http.Extensions/test/RequestDelegateGenerator/CompileTimeIncrementalityTests.cs). 
This particular setup works by enabling step tracking in the generator driver, then parsing the result object produced by the generator execution to unwrap the steps that we care about. Each step has a run reason associated with it, which indicates whether or not it ran and if it ran because a previous stage of the pipeline changed between iterations.

Here's a simplified example of how incremental testing works:

```csharp
[Fact]
public void Generator_DoesNotRerunWhen_InputsUnchanged()
{
    var driver = CSharpGeneratorDriver.Create([generator])
        .WithUpdatedParseOptions(ParseOptions)
        .EnableIncrementalTracking();
    
    // First run
    var firstRun = driver.RunGeneratorsAndUpdateCompilation(compilation, out _, out _);
    
    // Second run with same inputs
    var secondRun = firstRun.GetRunResult().Results[0].TrackedSteps["transform"]
        .Single().Outputs.Single().Reason;
    
    Assert.Equal(IncrementalStepRunReason.Cached, secondRun);
}
```

This type of testing is essential for ensuring that source generators don't negatively impact build performance, especially in large codebases where generators might process thousands of files.

So all in all, with a robust enough testing infrastructure for your source generators, you can:

1. Test both compilation success and runtime behavior to ensure generated code works in real scenarios
2. Use tools like Verify to make generated code changes visible and reviewable — a major plus for peer review
3. Verify that your generators respect incremental compilation for optimal build performance when possible

The infrastructure I've described here has served well across multiple source generators in the ASP.NET Core ecosystem. While the initial setup requires some investment, the confidence it provides in the correctness and performance of generated code makes it worthwhile for any source generator project.