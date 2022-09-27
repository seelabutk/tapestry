window.USE_AWS = false;

function _TOGGLE() {
	window.USE_AWS = !window.USE_AWS;
	$('.hyperimage').each(function(i, d) {
		$(d).data('tapestry').settings.host = _TAPESTRY_HOST();
		$(d).data('tapestry').setup_tiles();
		$(d).mousedown()
		$(d).mouseup()
	});

}

function _TAPESTRY_HOST() {
	return window.USE_AWS
		? 'http://3.86.88.218'
		: 'https://accona.eecs.utk.edu';
}

window.TAPESTRY_HOST = _TAPESTRY_HOST();

document.addEventListener('DOMContentLoaded', function() {
	const extra = ('' + window.location).includes('/extra/') ;
	const index = ('' + window.location).includes('index.html');
	const home = (('' + window.location) === 'https://seelabutk.github.io/tapestry/')

	if (extra || index || home) {
		const div = document.createElement('div');
		div.style.position = 'fixed';
		if (extra) div.style.top = 0;
		if (index) div.style.top = '50px';
		div.style.left = '40%';
		div.style.background = '#aca';
		div.style.zIndex = 10000;
		div.style.padding = '1em';
		div.style.borderRadius = '0em 0em 1em 1em';
		div.style.cursor = 'pointer';
		function _TEXT() {
			return document.createTextNode('Tapestry served by ' + (USE_AWS ? 'AWS' : 'Seelab Cloud'));
		}
		let text = _TEXT();
		div.appendChild(text);
		document.body.appendChild(div);
		div.addEventListener('click', function() {
			_TOGGLE();
			const newText = _TEXT();
			div.replaceChild(newText, text);
			text = newText;
		});
	}
});
