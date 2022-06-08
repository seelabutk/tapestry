/**
 * The main tapestry module written in the jQuery module format
 * @namespace Tapestry
 */
;(function ($, window){
    /**
     * Appends the tapestry function to jQuery functions. 
     * @param {object} options - All tapestry settings can 
     * be overridden in the options dictionary.
     */
    $.fn.tapestry = function(options)
    {
        // Make and store a tapestry per container
        if (options === undefined || typeof options === 'object')
        {
            // Setup event handlers for each hyperaction
            $('.hyperaction').on("click", function(){
                var action = $(this).attr("data-action");
                var owner = $(this).attr("for");
                $("#" + owner).data("tapestry").do_action(action);
            });

            return this.each(function(){
                if (!$.data(this, "tapestry"))
                {
                    $.data(this, "tapestry", new Tapestry(this, options));
                }   
            }); 
        }

        // TODO:If the options is a string then expose the plugin's methods
    }

    /**
     * Creates a tapestry hyperimage
     * @constructor
     * @memberOf Tapestry
     */
    function Tapestry(element, options)
    {
        this.element = element;
        this.settings = $.extend({}, $.fn.tapestry.settings, options);
        this.init();
    }

    /**
     * Generates and returns a unique id for this hyperimage
     * @deprecated
     */
    function generate_uuid()
    {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                    return v.toString(16);
        });
    }

    /**
     * Detects the browser. Used for fixing smooth scrolling. 
     * @static
     */
    function detectBrowser()
    {
        var browser = "";
        if (window.navigator.userAgent.indexOf('Edge') > -1)
        {
            browser = "edge";
        }
        else
        {
            browser = "other";
        }
        return browser;
    }

    /**
     * The initialization function that makes a hyperimage ready
     */
    Tapestry.prototype.init = function()
    {
        this.canceler = 0;
        this.cached_images = [];
        this.camera = null;
        this.is_drag = false;
        this.linked_objs = [];
        this.id = generate_uuid(); // deprecated
        this.timeseries_timer = null;
        this.current_timestep = 0;
        this.timerange = [0, 0];
        this.timelog = {};
        this.keyframes = [];

        // For scrolling support
        this.browser = detectBrowser();
        this.scroll_cma = 0; // cumulative moving average of scroll speed
        this.scroll_counter = 0;
        
        $(this.element).attr("width", this.settings.width);
        $(this.element).attr("height", this.settings.height);

        $(this.element).css("width", this.settings.width.toString() + "px");
        $(this.element).css("height", this.settings.height.toString() + "px");

        this.setup_tiles();

        if ($(this.element).attr("data-timerange"))
        {
            var range = $(this.element).attr("data-timerange").split("..");
            this.timerange[0] = parseInt(range[0]);
            this.timerange[1] = parseInt(range[1]);
        }

        if ($(this.element).attr("data-isovalues"))
        {
            this.settings.do_isosurface = true;
            this.settings.isovalues = 
                $(this.element).attr("data-isovalues")
                .split(",").map(function(i){return parseFloat(i)});
        }

        if ($(this.element).attr("data-filters"))
        {
            this.settings.filters = $(this.element).attr("data-filters").split(",");
        }

        var original_position = $V([0, 0, this.settings.zoom, 1]);
        if ($(this.element).attr("data-position"))
        {
            var temp = $(this.element).attr("data-position").split(",");
            temp = temp.map(function(x) { return parseFloat(x); });
            temp.push(1.0);
            original_position = $V(temp);
        }

        // First render
        this.setup_camera(original_position);
        this.setup_handlers();
        $(this.element).mousedown();
        $(this.element).mouseup();
        this.camera.Quat = [0.0, 0.0, 0.0, 1.0];
    }

    /**
     * Sets up the camera with a specific position and up vector, defaults are used if the parameters are undefined
     * @param {array} position - Four element array of floats representing the position [x, y, z, w]
     * @param {array} up - Four element array representing the up vector [x, y, z, w]
     */
    Tapestry.prototype.setup_camera = function(position, up)
    {
        this.camera = new ArcBall();
        this.camera.up = (typeof up !== 'undefined' ? up : $V([0, 1, 0, 1.0]));
        this.camera.position = (typeof position !== 'undefined' ? position : $V([0, 0, this.settings.zoom, 1.0]));

        this.camera.setBounds(this.settings.width, this.settings.height);
        this.camera.zoomScale = this.camera.position.elements[2];
    }

    /**
     * Removes all tiles (if they exist) and sets up tiling
     * in the hyperimage. It uses settings.n_tiles to determine
     * the number of tiles needed. Does not call render at then, 
     * therefore the hyperimage will be blank after this function
     * until render is called. 
     */
    Tapestry.prototype.setup_tiles = function()
    {
        $(this.element).empty();
        var base = $("<div>")
            .attr("class", "tapestry-tile-base")
            .css({
                "width": this.settings.width,
                "height": this.settings.height,
                "pointer-events": "none"
            })
            .appendTo(this.element);

        var n_tiles = this.settings.n_tiles;
        var n_cols = Math.sqrt(n_tiles);
        var tile_width = this.settings.width / n_cols;

        for (var i = 0; i < n_tiles; i++)
        {
            $("<img>")
                .attr("class", "tapestry-tile-image")
                .attr("id", "tapestry-tile-" + i.toString())
                .css({
                    "float": "left",
                    "width": tile_width + "px",
                    "height": tile_width + "px"
                })
                .appendTo(base);
        }
    }

    /**
     * Returns the position and up vector of the camera as arrays of floats
     */
    Tapestry.prototype.getCameraInfo = function()
    {
        var m = $M(this.camera.Transform);
        m = m.inverse();

        var new_camera_position = m.multiply(this.camera.position);
        var new_camera_up = m.multiply(this.camera.up);

        var x = new_camera_position.elements[0];
        var y = new_camera_position.elements[1];
        var z = new_camera_position.elements[2];

        var upx = new_camera_up.elements[0];
        var upy = new_camera_up.elements[1];
        var upz = new_camera_up.elements[2];

        return { position: new_camera_position.elements, up: new_camera_up.elements };
    }

    /**
     * Replaces the current tiling setup with a single tile, 
     * and saves the previous "n_tiles" setting in settings.n_tiles_backup
     */
    Tapestry.prototype.tiling_off = function()
    {
        this.settings.n_tiles_backup = this.settings.n_tiles;
        this.settings.n_tiles = 1;    
        this.setup_tiles();
        this.settings.tiling_status = "off";
    }

    /**
     * Turns tiling back on meaning that it replaces the current tiles
     * with new tiles. The number of tiles is retrieved from settings.n_tiles_backup
     */
    Tapestry.prototype.tiling_on = function()
    {
        this.settings.n_tiles = this.settings.n_tiles_backup;   
        this.setup_tiles();
        this.settings.tiling_status = "on";
    }

    /**
     * Creates the path of a hyperimage request and returns the string
     *
     * @param {int} imagesize - The size of the image to be requested.
     * If set to zero, then settings.width is used. 
     *
     * @param {int} tileid - The number of the tile to be requested. 
     * If left undefined, the complete image is requested.
     */
    Tapestry.prototype.make_request = function(imagesize, tileid)
    {
        var tiling = true;
        if (typeof tileid == 'undefined')
        {
            tiling = false;
        }

        var m = $M(this.camera.Transform);
        m = m.inverse();

        var new_camera_position = m.multiply(this.camera.position);
        var new_camera_up = m.multiply(this.camera.up);

        var precision = 3;
        var x = new_camera_position.elements[0].toFixed(precision);
        var y = new_camera_position.elements[1].toFixed(precision);
        var z = new_camera_position.elements[2].toFixed(precision);

        precision = 3;
        var upx = new_camera_up.elements[0].toFixed(precision);
        var upy = new_camera_up.elements[1].toFixed(precision);
        var upz = new_camera_up.elements[2].toFixed(precision);

        var viewx = -x;
        var viewy = -y;
        var viewz = -z;

        var dataset = $(this.element).attr("data-dataset");
        
        var options = {};

        if (tiling)
        {
            options["tiling"] = tileid.toString() + "-" + this.settings.n_tiles.toString();
        }

        if ($(this.element).attr("data-colormap"))
        {
            options["colormap"] = $(this.element).attr("data-colormap");
        }

        if (this.settings.n_timesteps > 1)
        {
            options["timestep"] = (this.current_timestep + this.timerange[0]);
        }

        if (this.settings.do_isosurface == true)
        {
            options["isosurface"] = this.settings.isovalues.toString()
                .replace(/,/g, "-");
        }

        // add filters if any
        if (this.settings.filters.length > 0)
        {
            options["filters"] = this.settings.filters.join("-");
        }

        // convert the options dictionary to a string
        var options_str = "";
        if (options.hasOwnProperty("timestep"))
        {
            // timestep needs to come first for the server
            options_str += "timestep," + options["timestep"] + ",";
        }
        for (var i in options)
        {
            if (i != "timestep")
                options_str += i + "," + options[i] + ",";
        }
        options_str = options_str.substring(0, options_str.length - 1);

        var quality = imagesize;
        if (imagesize == 0)
        {
            quality = this.settings.width;
        }

        var host;
        if (this.settings.host.constructor === Array)
        {
            var random = Math.floor(Math.random() 
                    * this.settings.host.length);
            host = this.settings.host[random] + "/";
        }
        else
        {
            host = this.settings.host + "/";
        }

        var path = host + "image/" + dataset + "/" + x + "/" + y + "/" + z
            + "/" + upx + "/" + upy + "/" + upz + "/"
            + viewx + "/" + viewy + "/" + viewz + "/"
            + quality.toString() + "/" + options_str;

        return path;
    }

    /**
     * Sends render requests to the server and renders the hyperimage. 
     * Internally calls {@link Tapestry#make_request}
     * 
     * @param {int} imagesize - The total image size for the render
     * @param {bool} remote_call - determines if this is called remotely from 
     * another hyperimage instance (used internally). Leave as undefined. 
     */
    Tapestry.prototype.render = function(imagesize, remote_call)
    {
        if (typeof remote_call === 'undefined')
        {
            remote_call = false;
        }

        if (!window._requests) {
            window._requests = new Set();
        }

        if (imagesize !== 0 && window._requests.size) {
            return;
        }

        var n_tiles = this.settings.n_tiles;
        var n_cols = Math.sqrt(n_tiles);
        var width = this.settings.width;

        var tiles = new Array(n_tiles).fill(0).map(function(d, i) { return i; });
        if (false && imagesize !== 0) {
            tiles = tiles.filter(function(d, i) {
                const x = i % n_cols - (n_cols/2|0) + 0.5,
                y = (i / n_cols|0) - (n_cols/2|0) + 0.5,
                dist = Math.hypot(x, y) / Math.hypot(n_cols/2-0.5, n_cols/2-0.5);
                return dist < 0.5;
            });
        }
        if (false) {
            tiles = tiles.filter(function(d, i) {
                const x = i % n_cols - (n_cols/2|0) + 0.5,
                y = (i / n_cols|0) - (n_cols/2|0) + 0.5,
                dist = Math.hypot(x, y) / Math.hypot(n_cols/2-0.5, n_cols/2-0.5);
                return Math.abs(y) < 0.15 * n_cols;
            });
        }
        var seed = new Array(n_tiles).fill(0).map(function(d, i, arr) {
            const x = i % n_cols - (n_cols/2|0) + 0.5,
            y = (i / n_cols|0) - (n_cols/2|0) + 0.5,
            dist = Math.hypot(x, y) / Math.hypot(n_cols/2-0.5, n_cols/2-0.5);
            return dist;
        });
        tiles.sort(function(a, b) { return seed[a] - seed[b]; });

        var requests = [];
        for (let i of tiles)
        {
            var path = this.make_request(imagesize, i);
            const img = new Image();
            var self = this;
            img.tileid = i.toString();

            // store timings in the log
            this.timelog[path.slice(path.indexOf("/image/"))] = [Date.now(), imagesize, false, 0];

            const timeoutId = setTimeout(function() {
                console.log('timeout');
                //window._requests.delete(img);
            }, 1000);

            img.onload = function(ev) {
                clearTimeout(timeoutId);
                var image_path = ev.target.src.slice(
                        ev.target.src.indexOf("/image/"));

                var tile = $(self.element)
                    .find("#tapestry-tile-" + i).eq(0);
                if (self.timelog.hasOwnProperty(image_path))
                {
                    self.timelog[image_path][3] = Date.now();
                    self.timelog[image_path][2] = tile.attr("src") === ev.target.src;
                }

                window._requests.delete(ev.target);
            }
            img.onerror = self.settings.error_callback;
            img.src = path;

            var tile = $(this.element)
                .find("#tapestry-tile-" + i).eq(0);
            tile.attr("src", path);

            window._requests.add(img);
        }

        // Don't rotate linked views if this call is
        // from one of them otherwise it'll be an infinite
        // loop
        if (!remote_call)
        {
            for (var i = 0; i < this.linked_objs.length; i++)
            {
                this.linked_objs[i].render(imagesize, true);
            }
        }
    }

    /**
     * Sends a single render request and doesn't support tiling
     * @deprecated
     */
    Tapestry.prototype.render_single = function(lowquality, remote_call)
    {
        if (typeof remote_call === 'undefined')
        {
            remote_call = false;
        }

        var path = this.make_request(lowquality);

        // Let's cache a bunch of the images so that requests
        // don't get cancelled by the browser. 
        // Cancelled requests causes the server to give up/become
        // slow for a specific client probably due to TCP timeouts.
        var temp = new Image();
        temp.src = path;
        this.timelog[temp.src] = [Date.now(), lowquality, false, 0];
        
        temp.onload = $.proxy(function(ev){
            this.timelog[ev.target.src][3] = Date.now();
            this.timelog[ev.target.src][2] = true;
        }, this);

        this.cached_images.push(temp);
        if (this.cached_images.length > this.settings.max_cache_length)
        {
            this.cached_images.splice(0, Math.floor(this.settings.max_cache_length / 2));
        }
        $(this.element).attr("src", path);

        // Don't rotate linked views if this call is
        // from one of them otherwise it'll be an infinite
        // loop
        if (!remote_call)
        {
            for (var i = 0; i < this.linked_objs.length; i++)
            {
                this.linked_objs[i].render(lowquality, true);
            }
        }
    }

    /**
     * returns logs statistics about user interactions. 
     */
    Tapestry.prototype.getInteractionStats = function()
    {
        var low_quality_sum = 0;
        var low_quality_n = 0;
        var high_quality_sum=0; 
        var high_quality_n=0;
        for (i in this.timelog)
        {
            if (this.timelog[i][1] && this.timelog[i][2])
            {
                low_quality_n++;
                low_quality_sum += this.timelog[i][3] - this.timelog[i][0];
            }
            else if (!this.timelog[i][1] && this.timelog[i][2])
            {
                high_quality_n++;
                high_quality_sum += this.timelog[i][3] - this.timelog[i][0];
            }
        }

        // print the information to console
        console.log("Average low quality time of response: ", low_quality_sum / low_quality_n);
        console.log("Average high quality time of response: ", high_quality_sum / high_quality_n);
        console.log("Number of answered requests: ", high_quality_n + low_quality_n);
        console.log("Number of requests sent: ", Object.keys(this.timelog).length);

        var self = this;
        var data = {
            "logs": self.timelog,
            "avg_low_quality_response_time": low_quality_sum / low_quality_n,
            "avg_high_quality_response_time": high_quality_sum / high_quality_n,
            "n_answered_requests": high_quality_n + low_quality_n,
            "n_sent_requests": Object.keys(self.timelog).length
        }
        this.timelog = {};
        return data;
    }

    Tapestry.prototype.rotate = function(mouse_x, mouse_y, imagesize)
    {
        if (this.is_drag)
        {
            this.is_drag = false;
            this.camera.move(mouse_x, mouse_y);
            this.render(imagesize);
            this.is_drag = true;
        }
    }
    
    Tapestry.prototype.unlink_camera = function()
    { 
        this.setup_camera();
        this.render(this.get_low_resolution());
    }
    
    Tapestry.prototype.link = function(target)
    {
        if (this.linked_objs.indexOf(target) == -1)
        {
            target.camera = this.camera;
            this.settings.camera_link_status = 2;

            /*for (i in this.linked_objs)
            {
                this.linked_objs[i].link(target);
            }*/

            this.linked_objs.push(target);
            // Add ourself to that object too
            target.linked_objs.push(this);

            target.render(this.get_low_resolution());
        }
    }
    
    // Currently, the target's camera gets reset to the original position
    // after unlinking.
    Tapestry.prototype.unlink = function(target, stop_recursion)
    {
        for (var i = 0; i < this.linked_objs.length; i++)
        {
            if (target.id == this.linked_objs[i].id)
            {
                this.linked_objs.splice(i, 1);
                if (!stop_recursion)
                {
                    target.unlink(this, true);
                    target.unlink_camera();
                }
            }
        } 
    }

    Tapestry.prototype.do_action = function(action)
    {
        var operator_index = action.search(/\+|=|\(|\)/);
        var operation = action.slice(0, operator_index);
        if (operation == 'position')
        {
            var position = action.slice(operator_index + 1);
            position = position.split(",");
            
            var m = $M(this.camera.Transform);
            m = m.inverse();

            var current_position = Vector.create(m.multiply(this.camera.position).elements.slice(0, 3));
            var pos = Vector.create([parseInt(position[0]), parseInt(position[1]), parseInt(position[2])]);
            this.camera.rotateTo(pos);
            this.render(this.get_low_resolution());
            return this;
        }
        else if (operation == 'link')
        {
            var targets = action.slice(operator_index + 1);
            targets = targets.replace(/\(|\)| /g, "");
            targets = targets.split(",");
            for (var i = 0; i < targets.length; i++)
            {
                this.link($("#" + targets[i]).data("tapestry"));
            }
        }
        else if (operation == 'unlink')
        {
            var targets = action.slice(operator_index + 1);
            targets = targets.replace(/\(|\)| /g, "");
            targets = targets.split(",");
            for (var i = 0; i < targets.length; i++)
            {
                this.unlink($("#" + targets[i]).data("tapestry"), false);
            }
        }
        else if (operation == 'play')
        {
            self = this;
            this.timeseries_timer = setInterval(function(){
                self.current_timestep = (self.current_timestep + 1) % (self.timerange[1] - self.timerange[0]);
                self.render(self.is_drag + 0);
            }, this.settings.animation_interval);
        }
        else if (operation == 'stop')
        {
            clearInterval(this.timeseries_timer);
        }
        else if (operation == 'switch_config')
        {
            var targets = action.slice(operator_index + 1);
            targets = targets.replace(/\(|\)| /g, "");
            targets = targets.split(",");
            $(this.element).attr("data-dataset", targets[0]);
            this.render(this.get_low_resolution());
        }

    }

    Tapestry.prototype.smooth_rotate = function(end_p)
    {
        var p = this.getCameraInfo().position;
        var orig_p = p;
        var up = this.getCameraInfo().up;
        var step = 0.05;
        while (step < 1.0)
        {
            p[0] = (end_p[0] - orig_p[0]) * step;
            p[1] = (end_p[1] - orig_p[1]) * step;
            p[2] = (end_p[2] - orig_p[2]) * step;
            var self = this;
            setTimeout(function(){
                self.do_action("position(" + p.slice(0, 3).toString() + ")");
                console.log(p, step);
            }, 20);
            step += 0.05;
        }
    }

    Tapestry.prototype.get_low_resolution = function()
    {
        var intended = this.settings.width / 8;
        // let's keep the min and max at 256 for now
        var MIN_LOW_RES_SIZE = 256;
        var MAX_LOW_RES_SIZE = 256;
        return this.settings.low_res; //Math.min(Math.max(intended, MIN_LOW_RES_SIZE), MAX_LOW_RES_SIZE);
    }

    Tapestry.prototype.get_high_resolution = function()
    {
        return 0;
    }

    Tapestry.prototype.setup_handlers = function()
    {
        var self = this;
        /*
        $(this.element).on("contextmenu", function(){
            return false;
        });
        */

        $(this.element).on("mousedown", function(event){
            self.is_drag = true;

            self.camera.LastRot = self.camera.ThisRot;
            self.camera.click(event.clientX - self.element.getBoundingClientRect().left, event.clientY - self.element.getBoundingClientRect().top);

            return false;
        });

        $(this.element).on("mousemove", function(event){
            self.canceler = (self.canceler + 1) % 1000;
            if (self.canceler % 5 == 0)
            {
                var mouse_x = event.clientX - self.element.getBoundingClientRect().left;
                var mouse_y = event.clientY - self.element.getBoundingClientRect().top;
                self.rotate(mouse_x, mouse_y, self.get_low_resolution()); // Render low quality version
            }
        });

        $(this.element).on("mouseup", function(event){
            if (event.which == 3)
            {
                // right click
                return false;
            }

            var mouse_x = event.clientX - self.element.getBoundingClientRect().left;
            var mouse_y = event.clientY - self.element.getBoundingClientRect().top;

            self.rotate(mouse_x, mouse_y, self.get_high_resolution()); // Render high quality version
            self.is_drag = false;
            return false;
        });
        
        $(this.element).on("dragstart", function(event){
            event.preventDefault();
        });

        $(this.element).on("wheel", function(event){
            if (self.settings.enableZoom == false)
                return false;

            // Edge has easing and requires request cancellation
            self.canceler = (self.canceler + 1) % 1000;
            if (self.canceler % 5 == 0 || self.browser != "edge")
            {
                // Normalize the scroll speed using a cumulative moving average
                var delta_sign = event.originalEvent.deltaY < 0 ? -1 : 1;
                var delta = Math.abs(event.originalEvent.deltaY);
                self.scroll_cma = (self.scroll_cma * self.scroll_counter + delta) * 
                    1.0 / (self.scroll_counter + 1);
                delta = delta_sign * delta / self.scroll_cma;
                delta *= 30;
                self.scroll_counter++; // this will grow indefinitely, must fix later

                self.camera.zoomScale -= delta;
                self.camera.position.elements[2] = self.camera.zoomScale;
                self.render(self.get_low_resolution());

                clearTimeout($.data(self, 'timer'));
                $.data(self, 'timer', setTimeout(function() {
                    self.render(self.get_high_resolution());
                }, 500));
            }
            return false;
        });

        /* 
         * Touch event handlers
         */
        $(this.element).on("touchstart", function(event){
            self.is_drag = true;
            console.log("touchstart");

            //update the base rotation so model doesn't jerk around upon new clicks
            self.camera.LastRot = self.camera.ThisRot;

            //tell the camera where the touch event happened
            self.camera.click(event.originalEvent.touches[0].clientX - 
                    self.element.getBoundingClientRect().left, event.originalEvent.touches[0].clientY - 
                    self.element.getBoundingClientRect().top);

            return false;
        });

        //handle touchEnd
        $(this.element).on("touchend", function(event){
            console.log("touchend");
            self.is_drag = false;

            self.render(self.get_high_resolution());
            return false;
        });

        //handle touch movement
        $(this.element).on("touchmove", function(event){
            console.log("touchmove");
            if (self.is_drag == true)
            {
                mouse_x = event.originalEvent.touches[0].clientX - self.element.getBoundingClientRect().left;
                mouse_y = event.originalEvent.touches[0].clientY - self.element.getBoundingClientRect().top;

                self.rotate(mouse_x, mouse_y, self.get_low_resolution()); // Render low quality version
            }
            return false;
        });

    }

    /*
     * Default settings for a tapestry object
     */
    $.fn.tapestry.settings = {
        host: "",
        width: 512,
        height: 512,
        low_res: 256,
        zoom: 512,
        n_tiles: 1,
        tiling_status: "on",
        max_cache_length: 512, // client-side caching for preventing browser request cancellation
        enable_zoom: true,
        enable_rotation: true,
        animation_interval: 100, // speed of timeseries animations
        n_timesteps: 1,
        do_isosurface: false,
        isovalues: [0], 
        filters: [],
        error_callback: function(){},
        camera_link_status: 0 // 0: Not linked, 1: Waiting to be linked, 2: Linked
    };

}(jQuery, window));
