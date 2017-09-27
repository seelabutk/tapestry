# Creates an Enchiladas container for the Tapestry project. 
# This Dockerfile was originally written by Tanner Hobson (thobson2@vols.utk.edu)

FROM ubuntu:latest
MAINTAINER Mohammad Raji <mahmadza@vols.utk.edu>

RUN apt-get update && \
    apt-get install -y \
            build-essential $(: all : compile tool) \
            cmake $(: all : compile tool) \
            python $(: pistache : running tests) \
            libtbb-dev $(: embree ospray : threading framework) \
            libglu1-mesa-dev $(: embree ospray : OpenGL requirements) \
            freeglut3-dev $(: embree ospray : OpenGL requirements) \
            mesa-common-dev $(: embree ospray : OpenGL requirements) \
            libc6-dev $(: enchiladas : pthreads) \
            libnetcdf-c++4-1 libnetcdf-dev libnetcdf-c++4-dev $(: pbnj : netcdf support) \
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
    make && \
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
    make -j && \
    make install && \
    rm -rf /opt/ospray

WORKDIR /opt/
COPY enchiladas /opt/enchiladas
COPY pbnj /opt/enchiladas/resources/pbnj
COPY pistache /opt/enchiladas/resources/pistache
WORKDIR /opt/enchiladas/build
RUN true && \
    cmake .. \
          -DCMAKE_CXX_COMPILER=g++ \
          -DCMAKE_C_COMPILER=gcc \
          -DUSE_NETCDF:BOOL=ON\
          -DBUILD_EXAMPLES:BOOL=OFF \
          -DOSPRAY_INSTALL_DIR=/usr/local/ \
          -Dembree_DIR=/opt/embree \
    && \
    make -j && \
    make install

CMD ["./server", "/config", "9010"]
