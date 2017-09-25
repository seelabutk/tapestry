#/bin/bash

tarurl="http://seelab.eecs.utk.edu/tapestry/tapestry_example_dirs.tar.gz"
tarfile=$(basename $tarurl)

if hash axel 2>/dev/null; then
    axel -a -n 4 $tarurl
else
    wget $tarurl
fi

tar xf $tarfile
