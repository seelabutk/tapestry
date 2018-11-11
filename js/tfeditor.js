function setup_tf_editor(element, callback)
{
	var width = 215,
    height = 100;

    points = [[0, height], [width, 0]];

	var dragged = null,
		selected = points[0];
     
    var special_node = false;
    var selected_index = 1;

	var line = d3.line();

	var svg = d3.select(element).append("svg")
		.attr("width", width)
		.attr("height", height)

	svg.append("rect")
		.attr("width", width)
		.attr("height", height)
		.on("mousedown", mousedown);

	svg.append("path")
		.datum(points)
		.attr("class", "line")
        .attr("id", "tf-line")
		.call(redraw);

	d3.select(element)
		.on("mousemove", mousemove)
		.on("mouseup", mouseup)
		.on("keydown", keydown);

	svg.node().focus();

    redraw();

    var self = this;

	function redraw() {
	  svg.select("path").attr("d", line);

	  var circle = svg.selectAll("circle")
		  .data(points, function(d) { return d; });

	  circle.enter().append("circle")
		  .attr("r", 1e-6)
		  .on("mousedown", function(d) { 
              selected = dragged = d; redraw(); 
              if (selected[0] == points[0][0] && selected[1] == points[0][1])
              {
                special_node = true;
              }
              var last_index = points.length - 1;
              if (selected[0] == points[last_index][0] && selected[1] == points[last_index][1])
              {
                  special_node = true;
              }
              
              for (var i = 0; i < points.length - 2; i++)
              {
                  if (selected[0] > points[i][0]) 
                  {
                      selected_index = i;
                      console.log(selected_index);
                      break;
                  }
              }
              
          })
		  .attr("r", 4);

	  circle
		  .classed("selected", function(d) { return d === selected; })
		  .attr("cx", function(d) { return d[0]; })
		  .attr("cy", function(d) { return d[1]; });

	  circle.exit().remove();

	  if (d3.event) {
		d3.event.preventDefault();
		d3.event.stopPropagation();
	  }
	}

	function change() {
	  line.interpolate("linear");
	  redraw();
	}

	function mousedown() {
        var new_point = d3.mouse(svg.node());
        for (i = 0; i < points.length - 1; i++)
        {
            if (new_point[0] > points[i][0] && 
                new_point[0] < points[i + 1][0])
            {
                points.splice(i + 1, 0, new_point);
                break;
            }
        }
        selected = dragged = new_point;
        redraw();
	}

	function mousemove() {
	  if (!dragged) return;
	  var m = d3.mouse(svg.node());
      if (!special_node && m[0] > points[selected_index ][0])
          dragged[0] = Math.max(0, Math.min(width, m[0]));
	  dragged[1] = Math.max(0, Math.min(height, m[1]));
	  redraw();
	}

	function mouseup() {
	  if (!dragged) return;
	  mousemove();
	  dragged = null;
      special_node = false;
      callback(self.get_tf());
	}

	function keydown() {
	  if (!selected) return;
	  switch (d3.event.keyCode) {
		case 8: // backspace
		case 46: { // delete
		  var i = points.indexOf(selected);
		  points.splice(i, 1);
		  selected = points.length ? points[i > 0 ? i - 1 : 0] : null;
		  redraw();
		  break;
		}
	  }
	}

    function get_y(x) 
    {
        var mapped_points = points.map(function(point){
            var temp = point[0];
            temp = 1.0 * temp / (points[points.length-1][0] - points[0][0]) * 255;
            return [temp, point[1]];
        });
        for (var i = 0; i < mapped_points.length - 1; i++)
        {
            if (x >= mapped_points[i][0] && x < mapped_points[i + 1][0])
            {
                var percent_x = (x - mapped_points[i][0]) / (mapped_points[i + 1][0] - mapped_points[i][0]);
                var y = mapped_points[i][1] + percent_x * (mapped_points[i + 1][1] - mapped_points[i][1]);
                y = height - y;
                // map to 255 
                y = 1.0 * y / height;
                return y;
            }
        }
    }

    this.get_tf = function()
    {
		var tf = [];
		for (i = 0; i < 255; i++)
		{
            var x = i / width * 255.0;
			tf.push(get_y(i));
		}
        return tf;
    }
}
