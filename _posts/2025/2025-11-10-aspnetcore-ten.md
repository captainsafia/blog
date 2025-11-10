---
title: And just like that .NET 10 ships tomorrow
description: "A look at key ASP.NET Core features shipping in .NET 10, including: model validation for Minimal APIs, OpenAPI 3.1 support with unified JSON Schema, improved integration testing with top-level programs, and new browser testing capabilities with WebApplicationFactory."
---

I had originally planned to write a proper deep-dive series walking through a handful of features I worked on in .NET 10: complete with design notes, trade-offs, and the fun weird corners. But, as happens, other things got in the way, and .NET 10 ships tomorrow, so I'm running out of time to cover everything. So instead of a whole series, I figured I'd just dump it all out in one big post. Let’s start with one of the bigger features.

## Model Validation for Minimal APIs (And Other Frameworks Too)

Minimal APIs have been part of ASP.NET Core since .NET 6, and they've always intentionally kept the programming model lightweight. But one thing they didn't have was built-in model validation. If you wanted to validate that the inputs coming into your REST API matched some constraints, there wasn't really a way to do that without leaning on an additional library or rolling your own code. This is a pretty unfortunate situation for such a key aspect of building REST APIs.

In .NET 10, we added first-class model validation support to Minimal APIs, and the implementation is AoT-compatible and extensible. AoT compatibility is a feature I harped on in [my earlier blog post on XML doc comment support in OpenAPI](2025-10-13-openapi-xml-generator.md). Ever since we made minimal APIs AoT-compatible in .NET 8, I've made an effort to ensure that any new features are trim-compatible to avoid compromising the core value prop. This sometimes makes things more difficult to implement than necessary and has required me to write way more source generators than I care to admit, but it's worth it for the cause.

OK, so about the source generator used in this case. At a high level, the generator scans your project at compile time looking for types that should be validated. Some of these types are discovered automatically if they appear as parameters in Minimal API handlers, but you can also explicitly opt types into validation with a `[ValidatableType]` attribute. When the generator finds these types, it emits code that registers them into a resolver.

Then at runtime, an endpoint filter looks up the corresponding resolver for the incoming request type and applies the validation rules. The resolver itself is DI-based, using the same plug-in model you might recognize from System.Text.Json’s serializer context. This makes the whole system inherently extensible: you can write your own resolvers, override the validation rules, or build new frameworks on top of it.

And that last part turns out to matter. Blazor has already taken advantage of this to support validating nested model types in Blazor forms; this was neat because it brought "official" validation support to Blazor beyond the Blazor-specific experimental package that has existed for years. Other frameworks can layer on top in the same way. We were hoping to validate the extensibility of the model with further integrations in .NET 10 but didn't get around to it. That's why the feature ships as experimental in .NET 10, with the plan to graduate it into an official `Microsoft.Extensions.Validation` package in future releases.

Moving forward, the hope is that emerging frameworks can build on top of this extensions package for their validation behavior instead of creating their own implementations. For an example of the validation package in action, check out this [sample app I made a couple of months ago](https://github.com/captainsafia/minapi-validation-support) to highlight some of the key aspects of the feature. It also includes a deeper dive into the implementation in the README.

## OpenAPI 3.1 Support (Finally Unified with JSON Schema)

Another area we invested in for .NET 10 is OpenAPI support. The .NET ecosystem had been sitting on OpenAPI 3.0 for a while, even though the 3.1 version of the OpenAPI spec has been available and widely requested. We worked closely with the maintainers of the OpenAPI.NET package (another team at MS) to bring full OpenAPI 3.1 support into that library first. It's the library that ASP.NET Core’s OpenAPI features depend on and it's used extensively throughout the .NET ecosystem by packages, like Swashbuckle and Kiota.

The big story in OpenAPI 3.1 is that its schema system is now a _true_ superset of JSON Schema. Previously, OpenAPI used a “JSON Schema-ish” variant that behaved similarly but wasn’t fully compatible. For example, you might notice that the way schema types are modeled in OpenAPI 3.0 and 3.1 differs: 3.1 allows you to model types using an array of values and captures nullability within the type value. This unification is great for interoperability, tooling, and schema reuse, but it also required refactoring internal layers and carrying some duplication where the standards don’t map perfectly yet.

## Smoothing Out Top-Level Program Access in Integration Tests

When C# introduced top-level statements, it cleaned up boilerplate in applications. You no longer needed to declare a `Program` class to house the entry point of your application. Instead, the compiler would generate one on your behalf, and you could structure your entry point as a series of top-level statements. However, this introduced a bit of a hiccup in the universe of integration testing.

If you were using `WebApplicationFactory<TEntryPoint>` to stand up a test host in your ASP.NET Core integration tests, you probably know what this issue is. The compiler-generated `Program` class that hosts your top-level app is internal by default. Since WebApplicationFactory needs a public type as its entry point, you had to declare your own `public partial class Program { }` or use `InternalsVisibleTo` to make the type visible to the test suite. Yeah, pretty gross.

I made this a _little_ bit better in .NET 10. A source generator now runs behind the scenes and makes the generated Program class public by default when needed. You don't need to use IVT or register an empty `public partial class` to get your test host working when using top-level apps.

If you're wondering why a source generator was necessary, there was a proposal that was taken through LDM to change the default visibility of the compiler-generated class. After some surveying though, this behavior as the compiler default is probably not wise given the ramifications of public accessibility. Also, it turns out ASP.NET Core apps were really the only ones that were making their `Program` class a public entry point, likely as a result of the way the integration testing interface worked anyway.

## Running Browser-Based Integration Tests with UseKestrel

While we're talking about WebApplicationFactory for integration testing, let's keep it going. It's been the go-to way to spin up an app in tests for a while, but there was always a catch: by default, it hosted the app using an in-memory server that didn't listen on a real port. That works well for HTTP client-based testing, but not so well for real browser tests. If you wanted to use something like Playwright or Selenium, you had to work around the fact that the app never actually bound to a network endpoint.

In .NET 10, we introduced the new `UseKestrel()` option when configuring a WebApplicationFactory. If you enable it, the app runs using Kestrel itself and binds to an actual local port. This means that your browser-based tests can hit a real endpoint for validating your UI, without having to deal with additional complexity. Here's what the test code for wiring up Playwright tests against a real application server might look like:

```csharp
public class UITests : WebApplicationFactory<Program>, IAsyncLifetime
{
    private IPlaywright? _playwright;
    private IBrowser? _browser;

    public UITests()
    {
        UseKestrel(options =>
        {
            options.Listen(IPAddress.Loopback, 0);
        });
    }

    public async Task InitializeAsync()
    {
        StartServer();

        _playwright = await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = false
        });
    }
}
```

## Fin

These weren’t the only contributions, and I still hope to write some more detailed deep dives in the future. But I wanted to get something out today that captures the design motivations and the shape of the work while it’s still fresh in my mind. A lot of the .NET 10 work this cycle has been about smoothing edges and enabling new testing and validation workflows that ripple across multiple frameworks. I'll be sharing a few details of this in the keynote at .NET Conf tomorrow and in the dedicated "What's New In ASP.NET Core" session. You can find the livestream for that [on the .NET Conf site](https://www.dotnetconf.net/).

Until next time!
