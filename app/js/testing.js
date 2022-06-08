Tester = function(configs)
{
    horde = null;
    state_machine_counter = 0;
    clickTypes = ['mousedown', 'mousemove', 'mouseup'];
    this.element = $(configs.element);
    this.log_server = configs.log_server;
    prevX = this.element.outerWidth() / 2.0;
    prevY = this.element.outerHeight() / 2.0;
    randy = new Chance();
    GREM_COUNTER = 0;
    self = this;

    path_index = 0;
    spline_anchors = [
        [self.element.outerWidth() / 2.0, self.element.outerHeight() / 2.0],
        [Math.random() * self.element.outerWidth(), Math.random() * self.element.outerHeight()],
        [Math.random() * self.element.outerWidth(), Math.random() * self.element.outerHeight()],
        [Math.random() * self.element.outerWidth(), Math.random() * self.element.outerHeight()]
    ];

    spline_path = Smooth(spline_anchors, {
        method: Smooth.METHOD_CUBIC,
        clip: Smooth.CLIP_CLAMP,
        cubicTension: Smooth.CUBIC_TENSION_CATMULL_ROM
    });

    mouse_up_prob = 1.0;
    randy.pick = function()
    {
        var finish_move = Math.random();
        GREM_COUNTER++;

        // Mouse move has happened and we randomly choose to do a mouse up now
        if (state_machine_counter == 1 && finish_move < mouse_up_prob)
        {
            state_machine_counter = 2;
            //prevX = self.element.outerWidth() / 2.0;
            //prevY = self.element.outerHeight() / 2.0;
            spline_anchors = [
                [self.element.outerWidth() / 2.0, self.element.outerHeight() / 2.0],
                [Math.random() * self.element.outerWidth(), Math.random() * self.element.outerHeight()],
                [Math.random() * self.element.outerWidth(), Math.random() * self.element.outerHeight()],
                [Math.random() * self.element.outerWidth(), Math.random() * self.element.outerHeight()]
            ];

            spline_path = Smooth(spline_anchors, {
                method: Smooth.METHOD_CUBIC,
                clip: Smooth.CLIP_CLAMP,
                cubicTension: Smooth.CUBIC_TENSION_CATMULL_ROM
            });
            path_index = 0;

            mouse_up_prob = 0.01;
            return 'mouseup';
        }

        // Mouse move has happened and we'll continue with that
        if (state_machine_counter == 1 && finish_move >= mouse_up_prob)
        {
            state_machine_counter = 1;
            return 'mousemove';
        }
        // Mouse down has happened. Clearly mousemove is next.
        if (state_machine_counter == 0)
        {
            state_machine_counter = 1;
            return 'mousemove';
        }

        // Mouse up happened and next comes mousedown
        if (state_machine_counter == 2)
        {
            state_machine_counter = 0;
            return 'mousedown';
        }
    }

    Tester.prototype.test = function(n_gremlins)
    {
        var state_machine_counter = 0;
        self = this;

        var custom_toucher = gremlins.species.clicker()
            .clickTypes(['mousedown', 'mousemove', 'mouseup'])
            .canClick(function(element){
                if ($(element).hasClass("hyperimage"))
                {
                    return true;
                }
                console.log("Not in bounds of the object.");
                return false;
            })
            .positionSelector(function(){
                var offset = self.element.offset();
                /*newPos = [prevX + ((Math.random() * 8) % self.element.outerWidth() - 4.0), 
                    prevY + ((Math.random() * 8) % self.element.outerHeight() - 4.0)];
                console.log(newPos);
                prevX = newPos[0];
                prevY = newPos[1];*/

                path_index += 0.01;
                return [spline_path(path_index)[0] + offset.left, spline_path(path_index)[1] + offset.top];
            })
            .randomizer(randy);

        horde = gremlins.createHorde()
            .gremlin(custom_toucher);

        horde.strategy(gremlins.strategies.distribution()
            .delay(8)
        );
        horde.after(function(){
            $(self.element).data("tapestry").getInteractionStats(self.log_server);
        });

        horde.unleash({nb: n_gremlins});
    }
}

getUrlParameter = null;
$(document).ready(function(){
    
  	getUrlParameter = function(sParam) {
        var sPageURL = decodeURIComponent(window.location.search.substring(1)),
            sURLVariables = sPageURL.split('&'),
            sParameterName,
            i;

        for (i = 0; i < sURLVariables.length; i++) {
            sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : sParameterName[1];
            }
        }
    }; 

	// Set up testing if needed
	if (getUrlParameter("test") && getUrlParameter("log_server"))
    {
        setTimeout(function(){
            var random = Math.floor(Math.random() * $(".hyperimage").length);
            /*$(".tapestry").eq(random).each(function(){
                tester = new Tester({element: this});
                tester.test();
            });*/
            tester = new Tester({element: $(".hyperimage").get(random), log_server: getUrlParameter("log_server")});
            tester.test(getUrlParameter("test"));
        }, 2000);
    }
});
