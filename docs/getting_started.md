# Tutorial

This tutorial covers all the aspects of the Tapestry project.

As part of the overall tutorial, we will be building a Wikipedia-esque example
that shows different volume renderings along with some text describing them.

We will cover two main parts of the application:

- A cluster of backend nodes to handle the volume rendering

- A webpage that makes the appropriate requests to the backend

# Getting Started

This part of the tutorial covers the process of getting started with Tapestry
and see the first built in application: a minimal volume rendering frontend.

## Installation

Tapestry has a hard dependency on Docker to provide the scaling architecture
and to build the renderer in a simple way. Internally, we have several parts
that do not depend on Docker, but Tapestry as a whole is dependent on Docker.

To install Docker, we refer to
[their documentation](https://docs.docker.com/engine/installation/).

Now we can clone the Tapestry repository and install its dependencies, which
can be accomplished with:

```console
$ git clone --recursive git@github.com:seelabutk/tapestry.git
```

Included with Tapestry is a helper script (called `tapestry.sh`) to manage some
of the aspects of the system. One such aspect is to check for dependencies and
download some of the archives that our project uses.

Every command in the `tapestry.sh` takes the form `./tapestry.sh <GLOBAL
OPTIONS> <COMMAND> <COMMAND OPTIONS>`. Similarly, every command accepts `-h` to
print out a help string for that command. For example:

```console
$ ./tapestry.sh -h
NAME
    tapestry

SYNOPSIS
    ./tapestry.sh [-s] [-n] [-h] [-v] COMMAND [OPTIONS]

DESCRIPTION
    Runs the appropriate Tapestry command based on COMMAND, with OPTIONS
    pertaining to COMMAND.

COMMANDS
    depend   Download and verify any dependencies for Tapestry
    build    Build the Docker image for Tapestry
    run      Create and run the Docker service using the built image
    stop     Stops all Tapestry-related services
    logs     Fetch and print any logs from the Tapestry service

OPTIONS
    -h
        Print this help message

    -s
        Run Docker commands using sudo

    -n
        Do a dry run (no commands actually get run)

```

To check for and download dependencies, run:

```console
$ ./tapestry.sh depend -v
```

If all goes well, the command won't print out any output. If any dependencies
are missing, it will print out some suggested fixes.

Now that dependencies are prepared, we can actually build the Tapestry Docker
image. This handles downloading any remaining build dependencies in the image
(i.e. cmake or Python) and compiling the source code for our systems.

If you're using a system with many cores, you can find an improved build time
by specifying the `-j` flag with a number of processes, which will get passed
to the Makefiles internal to the project. For example, with a machine with 16
cores, you might choose to run `./tapestry.sh build -j 16`. Note: if you use
the `-j` flag once, then you should continue using the same value, or else the
system will have to recompile everything again, due to a quirk with Docker.

```console
$ ./tapestry.sh build -j 16
```

## Running the Examples

Now that the system has been compiled, we can download some of the models the
Tapestry project includes. This is done by running the command:

```console
$ ./tapestry.sh examples -v -p
```

With the examples downloaded, we can create and run the Docker service. We have
to pass it a path to the config and data directories, which if we're using the
example data, are located under `./examples/configs/` and `./examples/data/`
respectively.

```console
$ ./tapestry.sh run -c examples/configs -d examples/data
```

This creates a Docker service, which you can see by running:

```console
$ docker service ls
ID                  NAME                MODE                REPLICAS            IMAGE                      PORTS
nrpv0zrnui06        tapestry            replicated          1/1                 tapestry_tapestry:latest   *:8080->9010/tcp
```

Then you can connect to your Tapestry instance by going to
`http://your.server.name.or.ip:8080/`.

## Overview and Next Steps

In this tutorial, we have shown how to get started with Tapestry. In the next
one, we will cover steps to distribute your Tapestry render backend to multiple
machines.

# Scaling

In this tutorial, we describe a process for scaling the backend and improving
the performance of the frontend through JavaScript minification.

## Scaling the number of processes

The easiest thing to do to improve performance is to run more processes on a
single worker node. If you've followed the tutorial until now, you have created
a Docker swarm with 1 node and are running one process on it. This can be seen
in the output of:

```console
$ docker service ls
ID                  NAME                MODE                REPLICAS            IMAGE                      PORTS
nrpv0zrnui06        tapestry            replicated          1/1                 tapestry_tapestry:latest   *:8080->9010/tcp
```

Where the "1/1" means "1 replica is working out of 1 replica requested". To
scale this up, we can run the command:

```console
$ docker service scale tapestry=8
```

This means that we want 8 processes total, and because we have 1 node, all 8
processes will run on that node. We can check that this works by looking at the
`docker service ls` again:

```console
$ docker service ls
ID                  NAME                MODE                REPLICAS            IMAGE                      PORTS
ukta5xqojgv8        tapestry            replicated          8/8                 tapestry_tapestry:latest   *:8080->9010/tcp
```

Note: if you see that replicas is displayed as "3/8" or similar, it either
means that the processes haven't fully started up (i.e. they are loading
data). After a minute or two, Docker should show that there are 8/8 replicas
ready.

Now the rendering process on the frontend should look snappier because it can
handle requests more quickly.

## Scaling the number of nodes

The other option for scaling is to add more nodes to the Docker swarm, thereby
running Tapestry on multiple machines.

To do this, you get your swarm id (somehow) and then on the other machines,
run:

```console
$ docker swarm join <swarm id>
```

## Autoscaling

Do:

```console
$ ./tapestry.sh autoscale
```

## Minification

```console
$ ./tapestry.sh build [-j whatever] -m
```

## Next Steps

Creating a custom application
