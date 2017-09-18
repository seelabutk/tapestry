#!/bin/bash

if [ ! -d "tapestry/pbnj/.git" ]; then
    git submodule update --init
else
    git submodule update
fi

if [ ! -f "tapestry/ispc-v1.9.1-linux.tar.gz" ]; then
    curl -L http://sourceforge.net/projects/ispcmirror/files/v1.9.1/ispc-v1.9.1-linux.tar.gz/download > tapestry/ispc-v1.9.1-linux.tar.gz
fi

if [ ! -f "tapestry/embree-2.16.4.x86_64.linux.tar.gz" ]; then
    curl -L https://github.com/embree/embree/releases/download/v2.16.4/embree-2.16.4.x86_64.linux.tar.gz > tapestry/embree-2.16.4.x86_64.linux.tar.gz
fi
docker-compose build --no-cache 
