# Tapestry (Scientific Visualization as a Microservice)

Powered by [Intel Rendering Framework](https://software.intel.com/en-us/rendering-framework)

Tapestry is a platform for creating lightweight, web-based volume rendering applications at scale, for many users. 

## Requirements
- Docker (https://www.docker.com/get-docker)

## Installation
Run `./tapestry.sh depend` to fetch and install the Tapestry submodules. 

Running `./tapestry.sh build` will then build and install the Tapestry Docker image. You can use `-j` to specify the number of processes for building. Use `-m` to minify the Javascript internally.

## Running the example
- To run the example, first download the data, the configurations, and the example app using `./tapestry.sh examples`
- Second, run `./tapestry.sh run -c examples/configs/ -d examples/data -a examples/app`
- Third, navigate to http://127.0.0.1:8080 in your browser
- `tapestry.sh` provides all of the management scripts needed for building and running. Run `./tapestry.sh -h` for more options
- Since Tapestry uses Docker Swarm, to kill the running service, run `docker service rm tapestry`

## Usage
To use Tapestry with your own page and datasets, you will need three things:
1. A directory with your datasets (currently, Tapestry supports raw single variable binary as well as NetCDF files)
1. A directory with one or more configuration files that point to the data. You can use the provided examples above as a starting point
1. An `index.html` with hyperimage and optionally, hyperaction tags

You can provide additional Tapestry options by editing `tapestry/enchiladas/src/js/main.js` after doing an initial build. You would also need to rebuild the image after any edits. 

If you use Tapestry, please cite one or both of these two papers: 

    @article{raji2018scientific,
      title={Scientific Visualization as a Microservice},
      author={Raji, Mohammad and Hota, Alok and Hobson, Tanner and Huang, Jian},
      journal={IEEE Transactions on Visualization and Computer Graphics},
      year={2018},
      publisher={IEEE}
    }

    @INPROCEEDINGS {Tapestry2017,
        author    = "M. Raji and A. Hota and J. Huang",
        title     = "Scalable web-embedded volume rendering",
        booktitle = "2017 IEEE 7th Symposium on Large Data Analysis and Visualization (LDAV)",
        year      = "2017",
        pages     = "45-54",
        month     = "Oct",
        doi       = "10.1109/LDAV.2017.8231850"
    }

More documentation can be found in the [wiki](https://github.com/seelabutk/tapestry/wiki).

