$(document).ready(function(){
    $(".hyperimage").tapestry({
        n_tiles: 1,
        width: 512,
        height: 512
    });

    // Listen to slider events and change the 
    // isosurface threshold accordingly
    $(".threshold-slider").on("input", function(){
        $(".hyperimage").eq(1).data("tapestry")
            .settings.isovalues=[parseInt($(this).val())];
        $(".hyperimage").eq(1).data("tapestry").render(0);
    });
});
