# Creates an Enchiladas container for the Tapestry project.
# This Dockerfile was originally written by Tanner Hobson (thobson2@vols.utk.edu)

FROM ubuntu:zesty
MAINTAINER Mohammad Raji <mahmadza@vols.utk.edu>

ARG build_parallel
ARG minifyjs

RUN apt-get update && \
    apt-get install -y \
            # Needed By: everything
            build-essential \
            # Needed By: everything
            cmake \
            # Needed By: pistache for running tests
            python \
            # Needed By: embree and ospray for their threading framework
            libtbb-dev \
            # Needed By: embree and ospray for OpenGL
            libglu1-mesa-dev freeglut3-dev mesa-common-dev \
            # Needed By: enchiladas for pthreads
            libc6-dev \
            # Needed By: pbnj for netcdf support
            libnetcdf-c++4-1 libnetcdf-dev libnetcdf-c++4-dev \
    && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/
COPY rapidjson /opt/rapidjson
WORKDIR /opt/rapidjson/build/
RUN true && \
    cmake .. \
          -DRAPIDJSON_BUILD_EXAMPLES:BOOL=OFF \
          -DRAPIDJSON_BUILD_TESTS:BOOL=OFF \
    && \
    make ${build_parallel} && \
    make install && \
    rm -rf /opt/rapidjson


WORKDIR /opt/
ADD ispc-v1.9.1-linux.tar.gz /opt/
RUN mv ispc-v1.9.1-linux ispc
WORKDIR /opt/ispc/
RUN update-alternatives --install /usr/bin/ispc ispc /opt/ispc/ispc 1

WORKDIR /opt/
ADD embree-2.16.4.x86_64.linux.tar.gz /opt/
RUN mv embree-2.16.4.x86_64.linux embree
WORKDIR /opt/embree/

WORKDIR /opt/
COPY ospray /opt/ospray
WORKDIR /opt/ospray/build
RUN true && \
    cmake .. \
          -Dembree_DIR=/opt/embree \
          -DOSPRAY_ENABLE_APPS:BOOL=OFF \
          -DOSPRAY_TASKING_SYSTEM=OpenMP \
    && \
    make ${build_parallel} && \
    make install && \
    rm -rf /opt/ospray

WORKDIR /opt/node
RUN apt-get update && \
    apt-get install -y curl && \
    curl http://nodejs.org/dist/node-latest.tar.gz | tar xz --strip-components=1 && \
    ./configure && \
    make install ${build_parallel} && \
    curl https://www.npmjs.org/install.sh | sh && \
    apt-get purge curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt/
COPY enchiladas /opt/enchiladas
COPY pbnj /opt/enchiladas/resources/pbnj
COPY pistache /opt/enchiladas/resources/pistache
WORKDIR /opt/enchiladas/build
RUN true && \
    npm --version && \
    ${minifyjs:+npm install -g uglify-js@3 nan} ${minifyjs:-true} && \
    cmake .. \
          -DCMAKE_CXX_COMPILER=g++ \
          -DCMAKE_C_COMPILER=gcc \
          -DUSE_NETCDF:BOOL=ON\
          -DBUILD_EXAMPLES:BOOL=OFF \
          -DOSPRAY_INSTALL_DIR=/usr/local/ \
          -Dembree_DIR=/opt/embree \
          -DENABLE_MINIFY=${minifyjs:+ON}${minifyjs:-OFF} \
    && \
    make ${build_parallel} && \
    make install

CMD ["./server", "/config", "9010"]
