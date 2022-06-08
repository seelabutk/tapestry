Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) { s = "0" + s; }
    return s;
}
urls = [];
Tools = {
    /* 
     * Gets a series of filenames, 
     * requests the data for them to render and returns a set of promises.
     * 
     * Requires a tapestry object in the DOM with the .hyperimage class
     */
    renderData: function(dataset, filename_set)
    {
        var position = $(".hyperimage").eq(0).data("tapestry").getCameraInfo().position;
        var up = $(".hyperimage").eq(0).data("tapestry").getCameraInfo().up;
        
        var tasks = [];
        // For all unique filenames that need rendering
        filename_set.forEach(function(filename){
            var promise = new Promise(function(resolve, reject){
                var host = "/image/" + dataset + "/" + position[0].toFixed(3) 
                    + "/" + position[1].toFixed(3) + "/" + position[2].toFixed(3)
                    + "/" + up[0].toFixed(3) + "/" + up[1].toFixed(3) + "/" + up[2].toFixed(3)
                    + "/" + (-position[0]).toFixed(3) + "/" + (-position[1]).toFixed(1)
                    + "/" + (-position[2]).toFixed(3) 
                    + "/" + "1024/colormap,hot,onlysave," + filename + ",filename," + filename;
                $.ajax({
                    url: host,
                    type: 'GET',
                    success: function(result){
                        resolve();
                    }
                });
            });
            tasks.push(promise);
        });

        return tasks;

    },

    renderAllAround: function(dataset, angle, starting_zoom)
    {
        var index = 0;
        var hyperimage = $(".hyperimage").eq(0).data("tapestry");
        var original_position = $V([0, 0, starting_zoom]);
        hyperimage.camera.rotateByAngle(-90, 'x', original_position);
        var tasks = [];
        for (var zoom = starting_zoom; zoom <= 900 + starting_zoom; zoom += 300)
        {
            for (var pitch = 0; pitch <= 180; pitch += angle)
            {
                for (var yaw = 0; yaw < 360; yaw += angle)
                {
                    //rotate hyperimage
                    //var position = $(".hyperimage").eq(0).data("tapestry").getCameraInfo().position;
                    //position[2] = zoom;
                    //var up = $(".hyperimage").eq(0).data("tapestry").getCameraInfo().up;
                    //var filename = "around_" + yaw + "_" + pitch;
                    
                    hyperimage.camera.zoomScale = zoom;
                    hyperimage.camera.position.elements[2] = zoom;
                    var path = hyperimage.render(0, false, true);
                    var filename = "around_" + index.pad(5);
                    path += "onlysave," + filename;
                    index++;

                    urls.push(path);
                    /*var promise = new Promise(function(resolve, reject){
                        var host = "/image/" + dataset + "/" + position[0].toFixed(3)
                        + "/" + position[1].toFixed(3) + "/" + position[2].toFixed(3)
                        + "/" + up[0].toFixed(3) + "/" + up[1].toFixed(3) + "/" + up[2].toFixed(3)
                        + "/" + (-position[0]).toFixed(3) + "/" + (-position[1]).toFixed(1)
                        + "/" + (-position[2]).toFixed(3) 
                        + "/" + "1/";//onlysave," + filename;
                        urls.push(host);
                        resolve();
                    });
                    tasks.push(promise);*/
                    hyperimage.camera.rotateByAngle(angle, 'y', original_position);
                }
                hyperimage.camera.rotateByAngle(angle, 'x', original_position);
            }
            hyperimage.camera.rotateByAngle(-180 - angle, 'x', original_position);
            var i = 0;
            
            /*var interval = setInterval(function(){
                if (i < urls.length)
                {
                    $.ajax({
                        url: urls[i],
                        type: 'GET',
                        success: function(result){
                        }
                    });
                    $(".main-hyperimage").attr("src", urls[i]);
                    i++;
                }
                else
                {
                    clearInterval(interval);
                }
            }, 100);*/
            
        }
        return tasks;
    },

    /*
     * Gets a run and timestep and builds the filename for it
     */
    buildFilename: function(run, timestep)
    {
        return "r" + run.pad(3) + "_t" + timestep.pad(2);
    },
};
