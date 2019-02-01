host = 'http://accona.eecs.utk.edu:8010';

sortable = null;
SettingsController = null;
settings = null;
tfeditor = null;
long_delay = 30;
short_delay = 30;
delay = long_delay;
play = false;
colormaps = ['viridis', 'plasma', 'inferno', 'magma', 'Greys', 'Purples', 'Blues', 'Greens', 'Oranges', 'Reds', 'YlOrBr', 'YlOrRd', 'OrRd', 'PuRd', 'RdPu', 'BuPu', 'GnBu', 'PuBu', 'YlGnBu', 'PuBuGn', 'BuGn', 'YlGn', 'binary', 'gist_yarg', 'gist_gray', 'gray', 'bone', 'pink', 'spring', 'summer', 'autumn', 'winter', 'cool', 'Wistia', 'hot', 'afmhot', 'gist_heat', 'copper', 'Diverging', 'PiYG', 'PRGn', 'BrBG', 'PuOr', 'RdGy', 'RdBu', 'RdYlBu', 'RdYlGn', 'Spectral', 'coolwarm', 'bwr', 'seismic', 'Pastel1', 'Pastel2', 'Paired', 'Accent', 'Dark2', 'Set1', 'Set2', 'Set3', 'tab10', 'tab20', 'tab20b', 'tab20c', 'flag', 'prism', 'ocean', 'gist_earth', 'terrain', 'gist_stern', 'gnuplot', 'gnuplot2', 'CMRmap', 'cubehelix', 'brg', 'hsv', 'gist_rainbow', 'rainbow', 'jet', 'nipy_spectral', 'gist_ncar'];

// should later contain all the loose globals
GUI = {};
GUI.keyframes = [];
GUI.n_interpolated_frames = 50;
GUI.timesteps = 1;

$(document).ready(function(){
    var simpleList = document.getElementById("simpleList");
    sortable = Sortable.create(simpleList, { 
        handle: ".handle",
        onUpdate: function(){
            console.log("updated");
            GUI.frames = [];
        }
    
    });

    Split(["#viewer-area", "#frame-area"], {
        direction: "vertical", 
        sizes: [85, 15]
    });

    $(".qs_main").draggable({});
    setTimeout(function(){
        $(".qs_main").css({
            position: "absolute",
            top: "50px",
            left: "10px"
        });
    }, 500);

    SettingsController =  {
        play: function()
        {
            $(".main-hyperimage").data("tapestry").do_action("play()");
        },

        stop: function()
        {
            $(".main-hyperimage").data("tapestry").do_action("stop()");
        },

        clone_keyframe_from_main: function()
        {
            var keyframe = {};
            var hyperimage = $(".main-hyperimage").data("tapestry");
            keyframe.rotation= hyperimage.camera.ThisRot;
            keyframe.zoom = hyperimage.camera.zoomScale;
            keyframe.timestep = hyperimage.current_timestep;
            keyframe.colormap = hyperimage.settings.colormap;
            if (hyperimage.settings.do_isosurface)
            {
                keyframe.isovalue = [hyperimage.settings.isovalues[0]];
            }
            SettingsController.add_keyframe(keyframe);
        },

        add_keyframe: function(keyframe)
        {
            GUI.frames = []; //MOA::remove later
            var dataset = settings.getValue("Datasets").value;
            var hyperimage = $("<div>")
                .addClass("hyperimage")
                .addClass("keyframe")
                .attr("id", dataset)
                .attr("data-dataset", dataset)
                .attr("src", "/image")
                .attr("width", 100)
                .attr("height", 100);

            var handle = $("<span>")
                .addClass("handle")
                .text("::");
            
            var new_frame = $("<li>")
                .addClass("list-group-item")
                .append(handle);

            new_frame.append(hyperimage);
            sortable.el.appendChild(new_frame.get(0));
            var hyperimage_obj = $(hyperimage).tapestry({
	        host: host,
                width: 100, 
                height: 100,    
                n_timesteps: GUI.timesteps
            });
            
            var tapestry = $(hyperimage_obj).data("tapestry");
            tapestry.camera.ThisRot = keyframe.rotation;
            
            // the zoomScale and the position's third element need to change 
            // to reflect the zooming, we should add a setZoom function to 
            // tapestry.js
            tapestry.camera.zoomScale = keyframe.zoom;
            tapestry.camera.position.elements[2] = keyframe.zoom;

            if (keyframe.hasOwnProperty("timestep"))
                tapestry.current_timestep = keyframe.timestep; 
            else
                tapestry.current_timestep = 0; 
            
            if (keyframe.hasOwnProperty("isovalue"))
            {
                tapestry.settings.do_isosurface = true;//keyframe.do_isosurface;
                tapestry.settings.isovalues = [keyframe.isovalue];
            }

            if (keyframe.hasOwnProperty("colormap"))
            {
                tapestry.settings.colormap = keyframe.colormap;
            }

            // not sure if we should keep this now that we're reading from a keyframe
            // object. maybe this can be an approach for keeping the user's settings
            // while importing other settings from an imported video
            //tapestry.settings = 
            //    $.extend(true, {}, $(".main-hyperimage").data("tapestry").settings);

            $(hyperimage_obj).mousedown();
            $(hyperimage_obj).mouseup();
        },

        render_animation: function()
        {
            var keyframes = [];
            $(".keyframe").each(function(){
                var temp_frame = {};
                temp_frame["rotation"] = $(this).data("tapestry").camera.ThisRot;
                temp_frame["zoom"] = $(this).data("tapestry").camera.zoomScale;
                if ($(this).data("tapestry").settings.n_timesteps > 1)
                {
                    temp_frame["timestep"] = $(this).data("tapestry").current_timestep;
                }
                if ($(this).data("tapestry").settings.do_isosurface)
                {
                    temp_frame["isovalue"] = $(this).data("tapestry").settings.isovalues[0];
                }
                keyframes.push(temp_frame);
            }); 
            $(".main-hyperimage").data("tapestry").keyframes = keyframes;
            $(".main-hyperimage").data("tapestry").animate(false);
            SettingsController.render_animation_server_side(keyframes.length);
        },

        render_animation_server_side: function(n_frames)
        {
            // for every interpolation (between two frames) 
            // we get 50 frames with a step of 0.02
            // so we have to have (n_frames-1)*50 images 
            // before we can generate the animation
            var n_images = (n_frames - 1) * 50;
            $.ajax({
                method: "GET",
                url: host + "/extern/render_animation/" + n_images.toString(),
                success: function(path){
                    if (path.indexOf("not ready") != -1)
                    {
                        setTimeout(function(){
                            SettingsController.render_animation_server_side(n_frames);
                        }, 1000);
                    }
                    else
                    {
                        // the video is ready. show the path
                        var modal = new tingle.modal({
                            closeLabel: "Close",
                            closeMethods: ['overlay', 'escape'], 
                        });
                        modal.setContent("<span style='font-family: sans-serif'>The video is ready. Click <a href='/app/data/animation.mp4'>here</a> to download.</span>");
                        modal.open();
                    }
                }
            });
        },

        change_colormap: function(colormap)
        {
            colormap = colormap.value;
            $(".main-hyperimage").data("tapestry").settings.colormap = colormap;
            $(".main-hyperimage").data("tapestry").render(0); 
        },

        isosurface: function(val)
        {
            $(".main-hyperimage").data("tapestry").settings.do_isosurface = val;
            $(".main-hyperimage").data("tapestry").settings.isovalues = [0.01];
            $(".main-hyperimage").data("tapestry").render(0);
        },

        change_isovalue: function(val)
        {
            $(".main-hyperimage").data("tapestry").settings.isovalues = [val];
            $(".main-hyperimage").data("tapestry").render(0);
        },

        change_data_range: function(text)
        {
            var min = parseFloat(settings.getValue("Data Min"));
            var max = parseFloat(settings.getValue("Data Max"));
            settings.setRangeParameters("Isovalue", min, max, (max-min) / 1000); 
        },

        change_timestep: function(val)
        {
            $(".main-hyperimage").data("tapestry").current_timestep = val; 
            $(".main-hyperimage").data("tapestry").render(0);
        },

        change_attenuation: function(val)
        {
            var tf = tfeditor.get_tf();
            tf = tf.map(function(x){
                return parseFloat(x.toFixed(1));
            });
            change_static_config({
                "opacityAttenuation": val,
                "opacityMap": tf
            });
        },

        change_dataset: function(val)
        {
            // clear any keyframes
            $(".list-group").html("");
            GUI.keyframes = [];
            $(".main-hyperimage").attr("data-dataset", val.value);
            $(".main-hyperimage").data("tapestry").render(0); 
            
            for (i in GUI.datasets)
            {
                if (GUI.datasets[i].name == val.value)
                {
                    GUI.timesteps = GUI.datasets[i].timesteps;
                    $(".main-hyperimage").attr("data-timerange", "0.." + (GUI.timesteps - 1).toString());
                    $(".main-hyperimage").data("tapestry").settings.n_timesteps = GUI.timesteps;
                    settings.setRangeParameters("Timestep", 0, GUI.timesteps, 1); 
                }
            }
        },

        export_animation: function()
        {
            var keyframes = {};
            var i = 0;
            $(".keyframe").each(function(){
                var temp_frame = {};
                temp_frame["rotation"] = $(this).data("tapestry").camera.ThisRot;
                temp_frame["zoom"] = $(this).data("tapestry").camera.zoomScale;
                if ($(this).data("tapestry").settings.n_timesteps > 1)
                {
                    temp_frame["timestep"] = $(this).data("tapestry").current_timestep;
                }
                if ($(this).data("tapestry").settings.do_isosurface)
                {
                    temp_frame["isovalue"] = $(this).data("tapestry").settings.isovalues[0];
                }
                keyframes["keyframe" + i] = temp_frame;
                i += 1;
            }); 
            var modal = new tingle.modal({
                closeLabel: "Close",
                closeMethods: ['overlay', 'escape'], 
            });
            modal.setContent("<pre>" + syntaxHighlight(JSON.stringify(keyframes, null, 4)) + "</pre>");
            modal.open();
        },

        import_animation: function()
        {
            // clear any keyframes
            $(".list-group").html("");
            GUI.keyframes = [];

            var human_readable_keyframes = JSON.parse(document.querySelector("#import-area").value); 

            // parse human readable format
            GUI.keyframes = [];
            for (var i = 0; i < Object.keys(human_readable_keyframes).length; i++)
            {
                var key = "keyframe" + i.toString();
                GUI.keyframes.push(human_readable_keyframes[key]);
            }

            for (key in GUI.keyframes)
            {
                if (!GUI.keyframes[key].hasOwnProperty("colormap"))
                {
                    GUI.keyframes[key].colormap = $(".main-hyperimage").data("tapestry").settings.colormap;
                }
                SettingsController.add_keyframe(GUI.keyframes[key]);
            } 
        },

        populate_temp_keyframes: function()
        {
            GUI.keyframes = [];
            var i = 0;
            $(".keyframe").each(function(){
                var temp_frame = {};
                temp_frame["rotation"] = $(this).data("tapestry").camera.ThisRot;
                temp_frame["zoom"] = $(this).data("tapestry").camera.zoomScale;
                if ($(this).data("tapestry").settings.n_timesteps > 1)
                {
                    temp_frame["timestep"] = $(this).data("tapestry").current_timestep;
                }
                if ($(this).data("tapestry").settings.do_isosurface)
                {
                    temp_frame["isovalue"] = $(this).data("tapestry").settings.isovalues[0];
                }
                GUI.keyframes.push(temp_frame);
            }); 
        },

        play_animation: function()
        {
            SettingsController.populate_temp_keyframes();
            delay = long_delay;
            var n_keyframes = GUI.keyframes.length;
            var last_timestep = new Date().getTime();
            var frame_no = 0;
            play = true;

            // start the animation loop
            window.requestAnimationFrame(function(){
                _animate(last_timestep, frame_no, n_keyframes, true);
            });
        },

        stop_animation: function()
        {
            play = !play;
            var hyperimage = $(".main-hyperimage").data("tapestry");
            hyperimage.tiling_on();
            hyperimage.render(hyperimage.settings.width);
        }
    }

    /*
     * produces a new interpolated frame, sets the necessary settings on a hyperimage 
     * so we can render it or get the URL to a potential render. 
     */
    function produce_interpolated_frame(hyperimage, keyframes, frame_no, index)
    {
        var i = frame_no;
        var j = index;
        // interpolate the rotation and the zoom
        var interpolation = hyperimage.camera.slerp(
                keyframes[i], 
                keyframes[i + 1], 
                j
        );

        // interpolate the timestep
        var timestep = 0;
        if (keyframes[i].hasOwnProperty("timestep") && keyframes[i + 1].hasOwnProperty("timestep"))
        {
            timestep = keyframes[i]["timestep"] + j *
                       (keyframes[i + 1]["timestep"] - keyframes[i]["timestep"]);
            timestep = Math.floor(timestep);
        }

        // interpolate a single isovalue
        var isovalue = -1;
        if (keyframes[i].hasOwnProperty("isovalue"))
        {
            isovalue = keyframes[i]["isovalue"][0] + j * 
                (keyframes[i + 1]["isovalue"][0] - keyframes[i]["isovalue"][0]);
        }

        var quat = interpolation[0].elements;
        var zoomlevel = interpolation[1];

        var lastrot = [  1.0,  0.0,  0.0,                  // Last Rotation
                   0.0,  1.0,  0.0,
                   0.0,  0.0,  1.0 ];
        hyperimage.camera.rotateFromQuaternion(quat, lastrot, zoomlevel);
        if (timestep != -1)
        {
            hyperimage.current_timestep = timestep;
        }
        if (isovalue != -1)
        {
            hyperimage.settings.do_isosurface = true;
            hyperimage.settings.isovalues = [isovalue];
        }
    }

    GUI.frames = {}; // interpolated frames temporarily for rendering
    function _animate(last_timestep, frame_no, length, also_play)
    {
        if (!play)
            return 

        var now = new Date().getTime();
        var delta = now - last_timestep;
        var hyperimage = $(".main-hyperimage").data("tapestry");
        if (hyperimage.settings.tiling_status == "on")
            hyperimage.tiling_off();

        if (delta >= delay)
        {
            // actually render a frame if it exists
            if (GUI.frames.hasOwnProperty(frame_no))
            {
                $(".main-hyperimage img").eq(0).attr("src", GUI.frames[frame_no].src);
                var next_frame = (frame_no + 1) % ((length - 1) * GUI.n_interpolated_frames);
                if (frame_no + 1 > (length - 1) * GUI.n_interpolated_frames)
                {
                    delay = short_delay;
                }
                frame_no = next_frame;
            }

            last_timestep = now;
        }

        // only fetch the frame, don't draw, but add it to a list
        var keyframe_index = (parseInt(frame_no / GUI.n_interpolated_frames));
        var interpolation_index = ((frame_no / GUI.n_interpolated_frames) 
            - keyframe_index);
        produce_interpolated_frame(hyperimage, GUI.keyframes, keyframe_index, interpolation_index);
        
        // get the path, render it and draw it on a canvas
        var path = hyperimage.make_request(hyperimage.settings.width); 
        var img = new Image();

        img.onload = function(){
            GUI.frames[frame_no] = this;
        }
        img.src = path;

        if (play)
        {
            window.requestAnimationFrame(function(){
                _animate(last_timestep, frame_no, length, also_play);
            });
        }

        /*
        var self = this;
        var counter = 0;
        for (var i = 0; i < this.keyframes.length - 1; i++)
        {
            for (var j = 0; j < 1; j += 0.02)
            {
                if (also_play)
                {
                    setTimeout(function(){
                        self.produce_interpolated_frame(i, j);
                        self.render(0);
                    }, 50);
                }
                else
                {
                    $(self).produce_interpolated_frame(i, j);
                    var path = this.render(0, undefined, true);
                    if (!path.endsWith("/"))
                    {
                        path += ",";
                    }
                    path += "onlysave," + counter.pad(3);
                    counter++;
                    var img = new Image();
                    img.src = path;
                }
            }
        }
        */
    }

    // deprecated
    function animate(length, also_play)
    {
        var last_timestep = new Date().getTime();
        var frame_no = 0;
        window.requestAnimationFrame(function(){
            _animate(last_timestep, frame_no, length, also_play);
        });
    }

    function change_static_config(options)
    {
        var dataset = $(".main-hyperimage").attr("data-dataset");
        $.ajax({
            method: 'GET',
            url: host + "/extern/getconfig/" + dataset,
            success: function(result)
            {
                var configs = JSON.parse(result);
                for (key in options)
                {
                    configs[key] = options[key];
                }
                $.post({
                    url: "/config/" + dataset,
                    data: JSON.stringify(configs),
                    success: function(){
                        $(".main-hyperimage").data("tapestry").render(0);
                    }
                });
            }
        });
    }

	function syntaxHighlight(json) 
    {
		if (typeof json != 'string') {
			 json = JSON.stringify(json, undefined, 2);
		}
		json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
			var cls = 'number';
			if (/^"/.test(match)) {
				if (/:$/.test(match)) {
					cls = 'key';
				} else {
					cls = 'string';
				}
			} else if (/true|false/.test(match)) {
				cls = 'boolean';
			} else if (/null/.test(match)) {
				cls = 'null';
			}
			return '<span class="' + cls + '">' + match + '</span>';
		});
	}

    function open_import_modal()
    {
        var modal = new tingle.modal({
            closeLabel: "Close",
            closeMethods: ['overlay', 'escape'], 
            footer: true,
            onOpen: function(){
                $("#import-area").focus();
            }
        });
        modal.setContent("<textarea id='import-area'></textarea>");
        modal.addFooterBtn("Import", "tingle-btn", function(){
            SettingsController.import_animation();
            modal.close();
        });
        modal.open();
    }

    // Setup the settings
    QuickSettings.useExtStyleSheet();
    settings = QuickSettings.create(0, 0, "Options");
    settings.addBoolean("Iso-surface rendering", false, SettingsController.isosurface);
    settings.addText("Data Min", "0.01", SettingsController.change_data_range);
    settings.addText("Data Max", "1", SettingsController.change_data_range);
    settings.addRange("Isovalue", 0, 1, 0, 0.001, SettingsController.change_isovalue);
    settings.addRange("Timestep", 0, 50, 0, 1, SettingsController.change_timestep);
    settings.addButton("Play timeseries", SettingsController.play);
    settings.addButton("Stop timeseries", SettingsController.stop);
    settings.addButton("Add keyframe", SettingsController.clone_keyframe_from_main);
    //settings.addButton("Render animation", SettingsController.render_animation);
    settings.addButton("Import animation", open_import_modal);
    settings.addButton("Export animation", SettingsController.export_animation);
    settings.addButton("Play animation", SettingsController.play_animation);
    settings.addButton("Stop animation", SettingsController.stop_animation);
    settings.addDropDown("Colormap", colormaps, SettingsController.change_colormap);
    settings.addHTML("Opacity map", "<div id='tfeditor'></div>");
    settings.addNumber("Opacity attenuation", 0, 1, 0.1, 0.01, SettingsController.change_attenuation);

    // Setup the transfer function editor
    tfeditor = new setup_tf_editor($("#tfeditor").get(0), function(tf){
        var dataset = $(".main-hyperimage").attr("data-dataset");
        // cut off decimal places from tf
        tf = tf.map(function(x){
            return parseFloat(x.toFixed(1));
        });
        change_static_config({
            "opacityMap": tf,
            "opacityAttenuation": settings.getValue("Opacity attenuation")
        });
    });

    // Populate the datasets dropdown
    $.ajax({
        method: "GET",
        url: host + "/extern/getdatasets",
        success: function(datasets)
        {
            GUI.datasets = JSON.parse(datasets);
            var dataset_names = GUI.datasets.map(function(dataset){
                return dataset.name; 
            });
            settings.addDropDown("Datasets", dataset_names, SettingsController.change_dataset);

            // set the data-timerange of the hyperimage
            GUI.timesteps = GUI.datasets[0].timesteps;
            $(".main-hyperimage").attr("data-timerange", "0.." + (GUI.timesteps - 1).toString());
            $(".hyperimage").tapestry({
	        host: host,
                n_timesteps: GUI.timesteps,
                width: 700,
                height: 700,
                n_tiles: 16
            });
            settings.setRangeParameters("Timestep", 0, GUI.timesteps, 1); 
        }
    });
});
