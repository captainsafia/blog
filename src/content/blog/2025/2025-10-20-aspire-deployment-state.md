---
title: "Cache me if you can: a look at deployment state in Aspire"
description: "Exploring the new deployment state caching feature in .NET Aspire that eliminates repetitive prompting during deployments and lays the foundation for more sophisticated deployment workflows and CI/CD integration."
tags: [aspire, deployment, caching, azure]
---

I recently merged in [a PR that adds support for deployment state](https://github.com/dotnet/aspire/pull/11877) to the `aspire deploy` command. I wanted to spend some time writing a little bit about the problem, the implementation, and how it will evolve in the context of developing APIs in Aspire for modeling deployment pipelines.

## The Problem: Stateless Deployments

For starters, if you're using the `aspire deploy` command to deploy an Aspire application to Azure in v9.5, you'll notice that the deployment is completely stateless. You'll be asked to provide provisioning parameters like your Azure subscription ID and the name of the resource group you'd like to target as well as any unresolved parameters in your application model _every time you deploy_. After a while this will get on your nerves and you'll be inclined to wonder what the heck is so hard about saving these values so you don't have to get prompted for them _every_ time.

## The Solution: Deployment State Caching

Before we answer that question, let's talk about how the deployment state feature that's currently in Aspire nightlies works. When you run `aspire deploy` for the first time in an Aspire project, you'll be prompted to provide the values as usual. However, you'll observe the following message at the top of the output when you deploy:

> Deployment state will be loaded from: ~/.aspire/deployments/abc123.../production.json

Aspire will cache the information you provide into a JSON file named after the deployment environment that you are targeting and in a directory based on the hash of the project path associated with your AppHost. Upon subsequent deployments, you won't be prompted for values again.

You can define different deployment environments to target by passing the `--environment` flag to the command. You can use the `--clear-cache` flag to return back to a stateless deployment: your cached values will be cleared, you'll be prompted for values again, and those values will not be saved to a cached file again.

The deployment state files are saved to `~/.aspire/deployments/{project-hash}/{environment}.json`, where `{project-hash}` is a SHA256 hash of your AppHost project path and `{environment}` corresponds to the deployment environment (e.g., `production.json`, `staging.json`).

So all in all, the experience for interacting with deployment state in the deploy command is as follows:

```bash
# First deployment: you'll be prompted for values
$ aspire deploy

# Subsequent deployments use cached state
$ aspire deploy

# Deploy to a different environment: you'll be prompted for values
$ aspire deploy --environment staging

# Clear cached state and start fresh
$ aspire deploy --clear-cache
```

The deployment state file that is cached looks something like this:

```json
{
  "Azure:SubscriptionId": "12345678-1234-1234-1234-123456789012",
  "Azure:Location": "westus2", 
  "Azure:ResourceGroup": "rg-aspire-app",
  "Parameters:WeatherApiKey": "foobarbaz"
}
```

When you're deploying to Azure, the file will also include a cache of the provisioning details associated with each Azure resource. This allows us to determine if we should reuse a request to the Azure resource manager to provision resources. If you haven't changed the way an Azure resource is described in the AppHost, we won't redeploy it. While this behavior is useful, it does introduce a new problem for us to solve: resource state drift. If a user leverages click-ops or alternative strategies to change the state of the resource in the cloud, our local cache will becoming invalidated.

## Implementation Details

On the framework side, all of these interactions are managed by an `IDeploymentStateManager` that outlines how deployment state should be loaded from a target resource (like a file on local disk or a remote configuration system) into an in-memory object on the AppHost. The deployment state is untyped by default and represented by an opaque `JsonObject`.

Aspire currently provides two main implementations of `IDeploymentStateManager`:

- **`FileDeploymentStateManager`**: Used during `aspire deploy`, stores state in `~/.aspire/deployments/`
- **`UserSecretsDeploymentStateManager`**: Used during `aspire run`, integrates with .NET's user secrets system

This abstraction allows for future implementations that could store state in cloud-based configuration services or integrate deployment state with artifact registration supported in CI/CD runners like GitHub Actions and Azure DevOps pipelines.

One of the design challenges in this area is that deployment state and configuration management in Aspire are overloaded. Aspire takes advantage of .NET's configuration management APIs to model config state in memory. These APIs are great for reading config values from various sources but they provide no API for _writing_ configuration values to various sources. This means that things get awkward with certain areas in Aspire where we _do_ take a dependency on .NET's configuration manager for values, specifically `ParameterResources` and `IOptions` instances. ParameterResources look for their initial values from the `Parameters:{name}` key in the IConfiguration object. Strongly-typed options objects via `IOptions` can also be bound from IConfiguration. This means that we have to mount the deployment state resource into IConfiguration as well to fully funnel things through.

### Schema-less Deployment State

Deployment state is written and saved as an opaque JSON object with no schema attached. The entire thing is based on an implicit agreement about the unique keys that are associated with each configuration value. We have no way of validating the deployment state that we load. If someone edited the deployment state file in-between deployments with invalid data, we don't eagerly handle this and the deployment is likely to fail in unexpected ways.

This is a blessing and a curse. Not having a schema lets us play around with the format unconstrained and let's anyone take advantage of the `IDeploymentStateManager` API. We also take away the need to manage schema versions. It remains to be seen whether deployment state will require a schema at some point, especially as we grow the set of implementations available to load and write deployment state to and from.

### CI/CD Integration

I mentioned CI/CD a few paragraphs back, but we should talk about some of the nuances around it, especially because it's different from the experience associated with running the command locally. Another thing we should touch on is how this relates to CI/CD environments. In those cases, deployment state is loaded and saved. If you called `aspire deploy` multiple times **within the same runner** you would reuse state. This lays the groundwork for being able to model single-step execution within the Aspire deployment pipeline as I discussed in [one of my previous posts](2025-10-06-aspire-publish-vs-deploy.md). .NET's configuration manager has its own strategy of fusing configuration options from different sources, one of these sources being environment variables. That means it's possible to circumvent the prompting process in CI/CD environments by setting `PARAMETERS_{NAME}` environment variables with the missing values.

### Security by Indirection

The configuration files that are saved are saved in a hidden folder in the home directory, not in the repo source. This reduces the risk of secrets leaking because developers accidentally commit the deployment state file. It doesn't address _all_ security concerns. For example, if you're machine is compromised and some has access to your entire filesystem your SOL anyways. But it provides good protections against accidentally leaking secrets. The approach taken here is very similar to the approach used by .NET's user secrets management implementation, which you can [read more about here](https://learn.microsoft.com/aspnet/core/security/app-secrets).

It also nudges users to use the existing `appsettings.{environment}.json` files to store deployment configuration that they want persisted to disk. `appsettings.{environment}.json` files are a standard configuration manager source that we're able to piggyback on as a configuration source. Those files typically _are_ committed to source control. This is a great strategy for configuration details that need to be stored across team members. For example, each dev might deploy tet stamps of their app to their own Azure resource group but to a shared subscription. The subscription would be stored in `appsettings` and the resource group would be prompted and saved during the initial deployment on a dev's local machine.

## Fin

Deployment state caching in Aspire reduces the repetitive prompting when running the `aspire deploy` command locally. This has a measurable impact in making the local deployment experience feel much snappier. More importantly, this feature provides the foundation for state management in more sophisticated deployment workflows and better CI/CD integration in future releases. I hope that the extensible `IDeploymentStateManager` API will grow nicely into scenarios that interact with cloud-based configuration providers or build environments.
