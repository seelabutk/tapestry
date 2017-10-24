# Tapestry (Scalable Web-Embedded Volume Rendering)

Tapestry is a platform for creating lightweight, web-based volume rendering applications at scale, for many users. 

## Requirements
- Docker (https://www.docker.com/get-docker)

## Installation
Run `./tapestry.sh depend` to fetch and install the Tapestry submodules. 

Running `./tapestry.sh build` will then build and install the Tapestry Docker image. You can use `-j` to specify the number of processes for building. Use `-m` to minify the Javascript internally.

## Running the example
- To run the example, first download the data and the configurations using `./tapestry.sh examples`
- Second, run `./tapestry.sh run -c examples/configs/ -d examples/data`
- Third, navigate to http://localhost:8080 in your browser
- `tapestry.sh` provides all of the management scripts needed for building and running. Simply run `./tapestry.sh -h` for more options
- Since Tapestry uses Docker Swarm, to kill the running service, simply run `docker service rm tapestry`

## Usage
To use Tapestry with your own page and datasets, you will need three things:
1. A directory with your datasets (currently, Tapestry supports raw single variable binary as well as NetCDF files)
1. A directory with one or more configuration files that point to the data. You can use the provided examples above as a starting point
1. An `index.html` with hyperimage and optionally, hyperaction tags

You can provide additional Tapestry options by editing `tapestry/enchiladas/src/js/main.js` after doing an initial build. You would also need to rebuild the image after any edits. 

If you use Tapestry, please cite the paper (http://seelab.eecs.utk.edu/tapestry/tapestry.pdf).

More documentation can be found in the [wiki](https://github.com/seelabutk/tapestry/wiki).

