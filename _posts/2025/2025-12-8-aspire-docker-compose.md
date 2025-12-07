---
title: "How Aspire composes itself: an overview of Aspire's Docker Compose integration"
description: "A deep dive into how Aspire's Docker Compose integration handles publishing, preparing, and deploying to a local compose instance."
---

Aspire's Docker Compose support has come up in a few conversations recently, so I figured it's worth breaking down how it works under the hood. If you're not familiar with it, [Aspire](https://aspire.dev) is a framework for modeling cloud-based apps. It lets you define your services and their dependencies in code (databases, caches, message queues, and the like) and handles the orchestration of running them locally or deploying them to the cloud. [Docker Compose](https://docs.docker.com/compose/) is a tool for defining and running multi-container applications using a YAML file. Aspire's Docker Compose integration bridges these two worlds: you model your app in Aspire's code-first style and Aspire generates the Docker Compose assets you need to run it.

Today, I want to explore what I've started conceptualizing as the "deployment lifecycle" for an Aspire integration: the multi-step process of going from an AppHost (the code where you define your application and its dependencies) to an actual running service. Aspire's deployment support for Docker Compose consists of four commands that build upon each other and model the lifecycle of a Docker Compose-based deployment. We'll walk through each of these commands in this blog post and you can see a complete sample application [in this repo](http://github.com/captainsafia/aspire-docker-compose-deploy) to explore further.

## The lifecycle, step by step

First is the `aspire do publish` command which generates Docker Compose YAML assets and `.env` files that are parameterized but unfilled. Note, this is equivalent to the `aspire publish` shorthand but I am using the `aspire do` command here to make it clear that these actions are modeled as steps in the pipeline.

```bash
$ aspire do publish
14:44:20 (pipeline-execution) → Starting pipeline-execution...
14:44:20 (publish-env) → Starting publish-env...
14:44:20 (publish-env) i [INF] Generating Compose output
14:44:20 (publish-env) → Writing the Docker Compose file to the output path.
14:44:20 (publish-env) ✓ Docker Compose file written successfully to /Users/captainsafia/git/tests/docker-compose-deploy/aspire-output/docker-compose.yaml. (0.0s)
14:44:20 (publish-env) ✓ publish-env completed successfully
14:44:20 (publish) → Starting publish...
14:44:20 (publish) ✓ publish completed successfully
14:44:20 (pipeline-execution) ✓ Completed successfully
```

The functionality of this command is powered by a light-weight, strongly-typed implementation of the Docker Compose YAML specification. This is what effectively allows you to manipulate the contents of the generated YAML file from code using Aspire's `PublishAsDockerComposeService`. That in-memory representation of the Docker Compose services is emitted into YAML on disk when the `publish` command runs.

```csharp
#:package Aspire.Hosting.Docker
#:package Aspire.Hosting.Python

#:sdk Aspire.AppHost.Sdk

var builder = DistributedApplication.CreateBuilder(args);

builder.AddDockerComposeEnvironment("env");

builder.AddPythonScript("todo-api", "./todos-fast-api", "main.py")
    .WithUvEnvironment()
    .WithHttpEndpoint(targetPort: 8000)
    .WithExternalHttpEndpoints()
    .PublishAsDockerComposeService((resource, service) =>
    {
        // Customizations go here
        service.Labels["target_env"] = "production";
    });

builder.Build().Run();
```

The `.env` file that is generated is not available for code-based editing in the same way that the Docker Compose declaration is. It's entirely meant to be a reflection of the parameters and inputs that are available in the Aspire app model to the resource. Those values _may_ be set when your AppHost is running because they are resolved from configuration or prompted for by the user. By default, the `publish` command doesn't materialize any of these values to the generated `.env` file.

This is an important distinction to call out because, as [previously discussed]({% post_url /2025/2025-10-06-aspire-publish-vs-deploy %}), the statement that the publish command generates assets that can be deployed is only partially true. In this particular case, the assets are essentially useless until you figure out how to fill in all the required parameters yourself.

This is particularly important because some of the required parameters are references to container images that need to be built. If you have runnable services that are modeled in your AppHost, Aspire needs to build a container image for it and push it to a registry. The `publish` command doesn't do this, it just leaves a placeholder in the `.env` file. This means that you'll need a way to build and push those images to a local or remote registry before you can actually deploy.

That's where the second command comes in. The `aspire do prepare-{resource-name}` command generates Docker Compose YAML assets and env files that are parameterized and filled.

```bash
$ aspire do prepare-env
14:45:23 (pipeline-execution) → Starting pipeline-execution...
14:45:23 (publish-env) → Starting publish-env...
14:45:23 (process-parameters) → Starting process-parameters...
14:45:23 (publish-env) i [INF] Generating Compose output
14:45:23 (process-parameters) ✓ process-parameters completed successfully
14:45:23 (deploy-prereq) → Starting deploy-prereq...
14:45:23 (build-prereq) → Starting build-prereq...
14:45:23 (build-prereq) ✓ build-prereq completed successfully
14:45:23 (deploy-prereq) i [INF] Initializing deployment for environment 'Production'
14:45:23 (deploy-prereq) i [INF] Setting default deploy tag 'aspire-deploy-20251207224523' for compute resource(s).
14:45:23 (deploy-prereq) ✓ deploy-prereq completed successfully
14:45:23 (build-pythonista) → Starting build-pythonista...
14:45:23 (build-pythonista) i [INF] Building container image for resource pythonista
14:45:23 (build-pythonista) i [INF] Building image: pythonista
14:45:23 (publish-env) → Writing the Docker Compose file to the output path.
14:45:23 (publish-env) ✓ Docker Compose file written successfully to /Users/captainsafia/git/tests/docker-compose-deploy/aspire-output/docker-compose.yaml. (0.0s)
14:45:23 (publish-env) ✓ publish-env completed successfully
14:45:23 (publish) → Starting publish...
14:45:23 (publish) ✓ publish completed successfully
14:45:24 (build-pythonista) i [INF] docker buildx for pythonista:9d1f657d87f6e617e09020ecbb978a291156190c succeeded.
14:45:24 (build-pythonista) i [INF] Building image for pythonista completed
14:45:24 (build-pythonista) ✓ build-pythonista completed successfully
14:45:24 (build) → Starting build...
14:45:24 (build) ✓ build completed successfully
14:45:24 (prepare-env) → Starting prepare-env...
14:45:24 (prepare-env) i [INF] Environment file '/Users/captainsafia/git/tests/docker-compose-deploy/aspire-output/.env.Production' already exists and will be overwritten
14:45:24 (prepare-env) ✓ prepare-env completed successfully
14:45:24 (pipeline-execution) ✓ Completed successfully
```

It bridges the gap between publish and deploy by:

- Filling in parameter values from configuration or user prompts
- Building container images and pushing them to the local registry
- Resolving connection strings and other resource references

By the time this command completes, you have assets that you can pass directly to the `docker compose up` command. Or you can use the third command in the stack which launches it for you and handles passing all the correct flags and arguments to Docker Compose. When I run `aspire do deploy`, Aspire launches Docker Compose locally on the machine.

```bash
$ aspire do deploy
14:45:41 (pipeline-execution) → Starting pipeline-execution...
14:45:41 (publish-env) → Starting publish-env...
14:45:41 (process-parameters) → Starting process-parameters...
14:45:41 (publish-env) i [INF] Generating Compose output
14:45:41 (process-parameters) ✓ process-parameters completed successfully
14:45:41 (deploy-prereq) → Starting deploy-prereq...
14:45:41 (build-prereq) → Starting build-prereq...
14:45:41 (build-prereq) ✓ build-prereq completed successfully
14:45:41 (deploy-prereq) i [INF] Initializing deployment for environment 'Production'
14:45:41 (deploy-prereq) i [INF] Setting default deploy tag 'aspire-deploy-20251207224541' for compute resource(s).
14:45:41 (deploy-prereq) ✓ deploy-prereq completed successfully
14:45:41 (build-pythonista) → Starting build-pythonista...
14:45:41 (build-pythonista) i [INF] Building container image for resource pythonista
14:45:41 (build-pythonista) i [INF] Building image: pythonista
14:45:41 (publish-env) → Writing the Docker Compose file to the output path.
14:45:41 (publish-env) ✓ Docker Compose file written successfully to /Users/captainsafia/git/tests/docker-compose-deploy/aspire-output/docker-compose.yaml. (0.0s)
14:45:41 (publish-env) ✓ publish-env completed successfully
14:45:41 (publish) → Starting publish...
14:45:41 (publish) ✓ publish completed successfully
14:45:42 (build-pythonista) i [INF] docker buildx for pythonista:8de08d760aa4d4227325d474e16815ea7be23b8d succeeded.
14:45:42 (build-pythonista) i [INF] Building image for pythonista completed
14:45:42 (build-pythonista) ✓ build-pythonista completed successfully
14:45:42 (build) → Starting build...
14:45:42 (build) ✓ build completed successfully
14:45:42 (prepare-env) → Starting prepare-env...
14:45:42 (prepare-env) i [INF] Environment file '/Users/captainsafia/git/tests/docker-compose-deploy/aspire-output/.env.Production' already exists and will be overwritten
14:45:42 (prepare-env) ✓ prepare-env completed successfully
14:45:42 (docker-compose-up-env) → Starting docker-compose-up-env...
14:45:42 (docker-compose-up-env) → Running docker compose up for env
14:45:44 (docker-compose-up-env) ✓ Service env is now running with Docker Compose locally (1.2s)
14:45:44 (docker-compose-up-env) ✓ docker-compose-up-env completed successfully
14:45:44 (print-pythonista-summary) → Starting print-pythonista-summary...
14:45:44 (print-pythonista-summary) i [INF] Successfully deployed pythonista to http://localhost:54845
14:45:44 (print-pythonista-summary) ✓ print-pythonista-summary completed successfully
14:45:44 (deploy) → Starting deploy...
14:45:44 (deploy) ✓ deploy completed successfully
14:45:44 (pipeline-execution) ✓ Completed successfully
```

One thing to note about `deploy` is that it will re-build the images and re-generate the Docker Compose assets each time it runs. It doesn't support using cached values yet, although there are ways that can be modeled via custom pipeline steps. The current implementation also assumes that you are using images from the local registry. There's no support for pulling remote images, although work is ongoing to support that kind of thing.

The fourth (and optional) command gives you the ability to tear down the environment that was created by running `aspire do docker-compose-down-env`.

## Why this multi-step approach?

This multi-step approach reflects the philosophy discussed in my [blog post about Aspire's Pipelines feature]({% post_url /2025/2025-11-03-aspire-pipelines %}): the more granular a representation you can create of the deployment steps that are involved in your workflow the the more extendable the system is. For example, in CI/CD pipelines you might want to run `publish` in one stage, `prepare` in another (perhaps with different credentials or in a different environment), and `deploy` in a third. This separation of concerns maps well to how pipelines are typically structured.

A more granular approach has value for debuggability and auditing, as well. If something goes wrong, you can inspect the intermediate artifacts. Did `publish` generate the right structure? Did `prepare` resolve the values correctly? This visibility is invaluable when troubleshooting.

Finally, more granular representations are more reusable. You can run `publish` once and then `prepare` multiple times with different configurations for dev, staging, and production environments. You can choose to enhance the default "deploy" behavior and do something else with the generated Docker Compose assets that isn't running Docker Compose locally on your machine.

This multi-step lifecycle is something we're refining across all of Aspire's deployment targets. The Docker Compose integration serves as a good proving ground for these concepts because the model for a Docker Compose service and its inputs is fairly simple.

## Fin

Aspire's Docker Compose support follows a four-step deployment lifecycle: `publish` generates parameterized assets, `prepare` resolves values and builds images, `deploy` launches the composition, and `docker-compose-down` tears it down. This separation provides flexibility for different deployment scenarios while keeping the core logic within the Aspire ecosystem. If you've been following along with my previous posts on [deployment state]({% post_url /2025/2025-10-20-aspire-deployment-state %}) and the [publish vs. deploy distinction]({% post_url /2025/2025-10-06-aspire-publish-vs-deploy %}), you'll see how these concepts come together in practice with the Docker Compose integration.
